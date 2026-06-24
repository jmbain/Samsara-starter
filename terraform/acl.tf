# ACL design per customer:
#
#   Producer (Samsara-managed SA, principal from var.customers[cid].producer_principal):
#     WRITE   on TOPIC prefix "samsara.{customerId}."  (PREFIXED)
#     DESCRIBE on TOPIC prefix "samsara.{customerId}." (PREFIXED)
#
#   Consumer (Busie-managed SA, confluent_service_account.consumer[cid]):
#     READ     on TOPIC prefix "samsara.{customerId}." (PREFIXED)
#     DESCRIBE on TOPIC prefix "samsara.{customerId}." (PREFIXED)
#     READ     on GROUP "samsara-consumer-{customerId}" (LITERAL)

locals {
  acls = {
    for pair in flatten([
      for cid, customer in var.customers : [
        # --- Producer ACLs (Samsara SA, external) ---
        {
          key           = "${cid}__producer_write"
          resource_type = "TOPIC"
          resource_name = "samsara.${cid}."
          pattern_type  = "PREFIXED"
          operation     = "WRITE"
          permission    = "ALLOW"
          host          = "*"
          principal     = customer.producer_principal
        },
        {
          key           = "${cid}__producer_describe"
          resource_type = "TOPIC"
          resource_name = "samsara.${cid}."
          pattern_type  = "PREFIXED"
          operation     = "DESCRIBE"
          permission    = "ALLOW"
          host          = "*"
          principal     = customer.producer_principal
        },
        # --- Consumer ACLs (Busie SA) ---
        {
          key           = "${cid}__consumer_read"
          resource_type = "TOPIC"
          resource_name = "samsara.${cid}."
          pattern_type  = "PREFIXED"
          operation     = "READ"
          permission    = "ALLOW"
          host          = "*"
          principal     = "User:${confluent_service_account.consumer[cid].id}"
        },
        {
          key           = "${cid}__consumer_describe"
          resource_type = "TOPIC"
          resource_name = "samsara.${cid}."
          pattern_type  = "PREFIXED"
          operation     = "DESCRIBE"
          permission    = "ALLOW"
          host          = "*"
          principal     = "User:${confluent_service_account.consumer[cid].id}"
        },
        {
          key           = "${cid}__consumer_group"
          resource_type = "GROUP"
          resource_name = "samsara-consumer-${cid}"
          pattern_type  = "LITERAL"
          operation     = "READ"
          permission    = "ALLOW"
          host          = "*"
          principal     = "User:${confluent_service_account.consumer[cid].id}"
        },
      ]
    ]) : pair.key => pair
  }
}

resource "confluent_kafka_acl" "this" {
  for_each = var.enable ? local.acls : {}

  resource_type = each.value.resource_type
  resource_name = each.value.resource_name
  pattern_type  = each.value.pattern_type
  operation     = each.value.operation
  permission    = each.value.permission
  host          = each.value.host
  principal     = each.value.principal

  rest_endpoint = data.confluent_kafka_cluster.this.rest_endpoint
  kafka_cluster { id = data.confluent_kafka_cluster.this.id }

  credentials {
    key    = local.kafka_api_key
    secret = local.kafka_api_secret
  }
}
