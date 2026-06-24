# Stores the Busie consumer API key/secret for each customer in AWS Secrets Manager.
# Path convention: "{name}/kafka/samsara-{customerId}"  (e.g. "wp/kafka/samsara-cust_001")
#
# The ECS task definition (separate Terraform scope) injects these as:
#   KAFKA_SASL_USERNAME  →  <secret_arn>:api_key::
#   KAFKA_SASL_PASSWORD  →  <secret_arn>:api_secret::
# See local.consumer_service_secrets in data.tf.

resource "aws_secretsmanager_secret" "consumer" {
  for_each = var.enable ? var.customers : {}

  name = "${var.name}/kafka/samsara-${each.key}"
}

resource "aws_secretsmanager_secret_version" "consumer" {
  for_each = aws_secretsmanager_secret.consumer

  secret_id = each.value.id

  secret_string = jsonencode({
    api_key    = confluent_api_key.consumer[each.key].id
    api_secret = confluent_api_key.consumer[each.key].secret
  })
}
