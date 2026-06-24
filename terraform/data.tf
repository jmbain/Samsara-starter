data "confluent_environment" "this" {
  display_name = var.env
}

data "confluent_kafka_cluster" "this" {
  display_name = "${var.name}-${var.env}"

  environment { id = data.confluent_environment.this.id }
}

data "aws_secretsmanager_secret" "kafka" {
  name = "wp/kafka"
}

data "aws_secretsmanager_secret_version" "kafka" {
  secret_id = data.aws_secretsmanager_secret.kafka.id
}

locals {
  # Prod uses standard_cluster_* keys; all other envs use kafka_* keys.
  # This matches the RMS convention exactly.
  kafka_api_key    = jsondecode(data.aws_secretsmanager_secret_version.kafka.secret_string)[var.env == "prod" ? "standard_cluster_api_key" : "kafka_api_key"]
  kafka_api_secret = jsondecode(data.aws_secretsmanager_secret_version.kafka.secret_string)[var.env == "prod" ? "standard_cluster_api_secret" : "kafka_api_secret"]

  # Per-customer consumer secret ARNs — used to build ECS secret injection references.
  # Maps customerId => ARN of the aws_secretsmanager_secret.consumer resource.
  consumer_secret_arns = {
    for cid, _ in var.customers : cid => aws_secretsmanager_secret.consumer[cid].arn
  }

  # ECS-injectable secret references for the Busie consumer service.
  # Format: "ENV_VAR_NAME" => "arn:...:field_name::"
  # These are merged per-customer at deploy time in the ECS Terraform (separate scope).
  consumer_service_secrets = {
    for cid, arn in local.consumer_secret_arns : cid => {
      KAFKA_SASL_USERNAME = "${arn}:api_key::"
      KAFKA_SASL_PASSWORD = "${arn}:api_secret::"
    }
  }
}
