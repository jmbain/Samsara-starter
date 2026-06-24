import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { LoggerService } from '../logger/logger.service';

const CONFLUENT_API_BASE = 'https://api.confluent.cloud';

/**
 * Samsara entity slugs — one topic is created per slug per customer.
 * Topic naming convention: samsara.{customerId}.{slug}
 *
 * NOTE: Verify this list against Settings → Data Streaming in the Samsara
 * dashboard when onboarding the first real customer. Samsara's connector
 * documentation at developers.samsara.com/docs/kafka-connector is the
 * authoritative source for supported entity types.
 */
const SAMSARA_ENTITY_SLUGS = [
  'gps-locations',
  'engine-states',
  'odometer-obd',
  'odometer-gps',
  'geofence-events',
  'route-events',
  'vehicle-events',
  'driver-events',
  'driver-vehicle-roster',
  'driver-hos-logs',
  'engine-hours',
  'fuel-levels',
  'fault-codes',
  'dvir-events',
  'safety-events',
] as const;

export interface ClusterInfo {
  clusterId: string;
  bootstrapEndpoint: string;
  restEndpoint: string;
}

export interface ProvisionResult {
  customerId: string;
  cluster: {
    id: string;
    bootstrapServer: string;
  };
  /**
   * Credentials for the Samsara producer service account.
   * The Busie admin copies apiKey and apiSecret into the Samsara dashboard
   * (Settings → Data Streaming → Connected Clusters) as SASL username/password.
   *
   * IMPORTANT: apiSecret is only returned once by the Confluent API.
   * Store it securely immediately — it cannot be retrieved again.
   */
  producerCredentials: {
    apiKey: string;
    apiSecret: string;
  };
  /** All 15 topic names provisioned for this customer. Enter each in Samsara stream subscriptions. */
  topics: string[];
  /** The Busie consumer group ID — for reference when configuring monitoring. */
  consumerGroupId: string;
}

@Injectable()
export class ConfluentService {
  private readonly managementClient: AxiosInstance;
  private readonly orgId: string;
  private readonly envId: string;
  private readonly cloudApiKey: string;
  private readonly cloudApiSecret: string;
  private readonly consumerSaId: string;
  private readonly consumerGroupId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.cloudApiKey = this.configService.get<string>('confluent.cloudApiKey') ?? '';
    this.cloudApiSecret = this.configService.get<string>('confluent.cloudApiSecret') ?? '';
    this.orgId = this.configService.get<string>('confluent.orgId') ?? '';
    this.envId = this.configService.get<string>('confluent.envId') ?? '';
    this.consumerSaId = this.configService.get<string>('confluent.consumerSaId') ?? '';
    this.consumerGroupId =
      this.configService.get<string>('kafka.consumerGroupId') ?? 'samsara-consumer-dev';

    // All management calls to api.confluent.cloud use Basic Auth with the Cloud-scoped key
    this.managementClient = axios.create({
      baseURL: CONFLUENT_API_BASE,
      auth: { username: this.cloudApiKey, password: this.cloudApiSecret },
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Full provisioning sequence for a new customer connection.
   * Intended to be called by ConfluentController when a customer clicks "Connect".
   *
   * Steps:
   *   1. Get or create the dedicated Samsara Confluent cluster
   *   2. Create 15 per-customer topics (samsara.{customerId}.{slug})
   *   3. Create a producer service account for this customer
   *   4. Create a Kafka-scoped API key for the producer SA
   *   5. Assign DeveloperWrite RBAC to producer SA on this customer's topic prefix
   *   6. Assign DeveloperRead RBAC to shared Busie consumer SA on topic prefix + consumer group
   *
   * NOTE: If cluster creation is triggered (CONFLUENT_CLUSTER_ID not set), this call
   * may take 1–3 minutes while the cluster reaches RUNNING state. Set
   * CONFLUENT_CLUSTER_ID and CONFLUENT_CLUSTER_REST_ENDPOINT after first run to skip this.
   */
  async provisionCustomer(customerId: string): Promise<ProvisionResult> {
    this.logger.log(`Starting Confluent provisioning for customer: ${customerId}`, ConfluentService.name);

    const cluster = await this.getOrCreateCluster();
    this.logger.log(`Using cluster: ${cluster.clusterId}`, ConfluentService.name);

    const topics = await this.createTopics(cluster.clusterId, cluster.restEndpoint, customerId);
    this.logger.log(`Created ${topics.length} topics for customer ${customerId}`, ConfluentService.name);

    const label = customerId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const producerSa = await this.createServiceAccount(
      `samsara-producer-${label}`,
      `Samsara producer SA for customer ${customerId}${this.configService.get<string>('app.env') !== 'production' ? ' [dev]' : ''}`,
    );
    this.logger.log(`Created producer SA ${producerSa.id} for customer ${customerId}`, ConfluentService.name);

    const producerKey = await this.createApiKey(
      producerSa.id,
      cluster.clusterId,
      `samsara-producer-key-${label}`,
      `Samsara connector API key — customer ${customerId}. Give to Samsara, do not share elsewhere.`,
    );
    this.logger.log(`Created producer API key for customer ${customerId}`, ConfluentService.name);

    // Samsara producer: write access scoped to this customer's topic prefix only
    await this.assignRbacRoleBinding(
      `User:${producerSa.id}`,
      'DeveloperWrite',
      this.buildTopicCrn(cluster.clusterId, `samsara.${customerId}.*`),
    );

    // Shared Busie consumer: read access on this customer's topic prefix
    await this.assignRbacRoleBinding(
      `User:${this.consumerSaId}`,
      'DeveloperRead',
      this.buildTopicCrn(cluster.clusterId, `samsara.${customerId}.*`),
    );

    // Shared Busie consumer: read access on the shared consumer group (idempotent across customers)
    await this.assignRbacRoleBinding(
      `User:${this.consumerSaId}`,
      'DeveloperRead',
      this.buildGroupCrn(cluster.clusterId, this.consumerGroupId),
    );

    this.logger.log(`Provisioning complete for customer ${customerId}`, ConfluentService.name);

    return {
      customerId,
      cluster: { id: cluster.clusterId, bootstrapServer: cluster.bootstrapEndpoint },
      producerCredentials: { apiKey: producerKey.keyId, apiSecret: producerKey.secret },
      topics,
      consumerGroupId: this.consumerGroupId,
    };
  }

  /**
   * Returns cluster info from config if CONFLUENT_CLUSTER_ID is already set,
   * otherwise creates a new Standard cluster.
   *
   * After first-time creation, persist CONFLUENT_CLUSTER_ID and
   * CONFLUENT_CLUSTER_REST_ENDPOINT in the environment to skip creation on
   * subsequent connect requests.
   */
  async getOrCreateCluster(): Promise<ClusterInfo> {
    const existingId = this.configService.get<string>('confluent.clusterId');
    const existingRest = this.configService.get<string>('confluent.clusterRestEndpoint');

    if (existingId && existingRest) {
      return this.getCluster(existingId);
    }

    return this.createCluster('samsara-integration');
  }

  async createCluster(displayName: string): Promise<ClusterInfo> {
    this.logger.log(`Creating Confluent Standard cluster: ${displayName}`, ConfluentService.name);

    const response = await this.managementClient.post('/cmk/v2/clusters', {
      spec: {
        display_name: displayName,
        cloud: 'AWS',
        region: 'us-east-1',
        availability: 'SINGLE_ZONE',
        config: { kind: 'Standard' },
        environment: { id: this.envId },
      },
    });

    const clusterId: string = response.data.id;
    await this.waitForClusterReady(clusterId);

    const info: ClusterInfo = {
      clusterId,
      bootstrapEndpoint: response.data.spec.kafka_bootstrap_endpoint,
      restEndpoint: response.data.spec.http_endpoint,
    };

    this.logger.log(
      `Cluster created. Add these to your environment to skip creation on future calls: ` +
        `CONFLUENT_CLUSTER_ID=${clusterId} CONFLUENT_CLUSTER_REST_ENDPOINT=${info.restEndpoint}`,
      ConfluentService.name,
    );

    return info;
  }

  async getCluster(clusterId: string): Promise<ClusterInfo> {
    const response = await this.managementClient.get(`/cmk/v2/clusters/${clusterId}`);
    return {
      clusterId: response.data.id,
      bootstrapEndpoint: response.data.spec.kafka_bootstrap_endpoint,
      restEndpoint: response.data.spec.http_endpoint,
    };
  }

  async createTopics(
    clusterId: string,
    clusterRestEndpoint: string,
    customerId: string,
  ): Promise<string[]> {
    // Topic management targets the cluster's own REST endpoint, not api.confluent.cloud
    const clusterClient = axios.create({
      baseURL: clusterRestEndpoint,
      auth: { username: this.cloudApiKey, password: this.cloudApiSecret },
      headers: { 'Content-Type': 'application/json' },
    });

    const topicNames: string[] = [];

    for (const slug of SAMSARA_ENTITY_SLUGS) {
      const topicName = `samsara.${customerId}.${slug}`;

      try {
        await clusterClient.post(`/kafka/v3/clusters/${clusterId}/topics`, {
          topic_name: topicName,
          partitions_count: 6,
          replication_factor: 3,
          configs: [
            { name: 'retention.ms', value: '604800000' }, // 7 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        });
        this.logger.log(`Created topic: ${topicName}`, ConfluentService.name);
      } catch (err: any) {
        if (err?.response?.status === 409) {
          // Topic already exists — idempotent, continue
          this.logger.log(`Topic already exists (skipping): ${topicName}`, ConfluentService.name);
        } else {
          throw err;
        }
      }

      topicNames.push(topicName);
    }

    return topicNames;
  }

  async createServiceAccount(
    displayName: string,
    description: string,
  ): Promise<{ id: string }> {
    const response = await this.managementClient.post('/iam/v2/service-accounts', {
      display_name: displayName,
      description,
    });
    return { id: response.data.id };
  }

  async createApiKey(
    serviceAccountId: string,
    clusterId: string,
    displayName: string,
    description: string,
  ): Promise<{ keyId: string; secret: string }> {
    const response = await this.managementClient.post('/iam/v2/api-keys', {
      spec: {
        display_name: displayName,
        description,
        owner: {
          id: serviceAccountId,
          kind: 'ServiceAccount',
        },
        resource: {
          id: clusterId,
          kind: 'Cluster',
          environment: { id: this.envId },
        },
      },
    });
    return {
      keyId: response.data.id,
      secret: response.data.spec.secret,
    };
  }

  async assignRbacRoleBinding(
    principal: string,
    roleName: string,
    crnPattern: string,
  ): Promise<void> {
    try {
      await this.managementClient.post('/iam/v2/role-bindings', {
        principal,
        role_name: roleName,
        crn_pattern: crnPattern,
      });
      this.logger.log(
        `Assigned ${roleName} to ${principal} on ${crnPattern}`,
        ConfluentService.name,
      );
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Binding already exists — idempotent, continue
        this.logger.log(
          `Role binding already exists (skipping): ${roleName} for ${principal}`,
          ConfluentService.name,
        );
      } else {
        throw err;
      }
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Polls GET /cmk/v2/clusters/{id} until status.phase === 'RUNNING'.
   * Standard clusters typically take 1–2 minutes after creation.
   */
  private async waitForClusterReady(
    clusterId: string,
    maxWaitMs = 180000,
  ): Promise<void> {
    const pollIntervalMs = 5000;
    const deadline = Date.now() + maxWaitMs;

    this.logger.log(
      `Waiting for cluster ${clusterId} to reach RUNNING state (max ${maxWaitMs / 1000}s)...`,
      ConfluentService.name,
    );

    while (Date.now() < deadline) {
      const response = await this.managementClient.get(`/cmk/v2/clusters/${clusterId}`);
      const phase: string = response.data?.status?.phase;

      if (phase === 'RUNNING') {
        this.logger.log(`Cluster ${clusterId} is RUNNING`, ConfluentService.name);
        return;
      }

      this.logger.log(`Cluster phase: ${phase ?? 'unknown'} — polling again in ${pollIntervalMs / 1000}s`, ConfluentService.name);
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `Cluster ${clusterId} did not reach RUNNING state within ${maxWaitMs / 1000}s`,
    );
  }

  /**
   * Builds a Confluent Resource Name (CRN) for a Kafka topic or topic prefix.
   * Pass topicName = 'samsara.{customerId}.*' to scope to a customer's full namespace.
   *
   * Format: crn://confluent.cloud/organization={orgId}/environment={envId}
   *         /cloud-cluster={clusterId}/kafka={clusterId}/topic={topicName}
   */
  private buildTopicCrn(clusterId: string, topicName: string): string {
    return (
      `crn://confluent.cloud/organization=${this.orgId}` +
      `/environment=${this.envId}` +
      `/cloud-cluster=${clusterId}` +
      `/kafka=${clusterId}` +
      `/topic=${topicName}`
    );
  }

  /**
   * Builds a CRN for a Kafka consumer group.
   *
   * Format: crn://confluent.cloud/organization={orgId}/environment={envId}
   *         /cloud-cluster={clusterId}/kafka={clusterId}/group={groupId}
   */
  private buildGroupCrn(clusterId: string, groupId: string): string {
    return (
      `crn://confluent.cloud/organization=${this.orgId}` +
      `/environment=${this.envId}` +
      `/cloud-cluster=${clusterId}` +
      `/kafka=${clusterId}` +
      `/group=${groupId}`
    );
  }
}
