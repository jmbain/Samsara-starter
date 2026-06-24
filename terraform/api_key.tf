resource "confluent_api_key" "consumer" {
  for_each = var.enable ? var.customers : {}

  display_name = confluent_service_account.consumer[each.key].display_name
  description  = "API Key owned by ${confluent_service_account.consumer[each.key].display_name}"

  owner {
    id          = confluent_service_account.consumer[each.key].id
    kind        = confluent_service_account.consumer[each.key].kind
    api_version = confluent_service_account.consumer[each.key].api_version
  }

  managed_resource {
    id          = data.confluent_kafka_cluster.this.id
    kind        = data.confluent_kafka_cluster.this.kind
    api_version = data.confluent_kafka_cluster.this.api_version
    environment { id = data.confluent_environment.this.id }
  }
}
