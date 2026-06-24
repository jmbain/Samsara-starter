# Creates one Busie-owned consumer service account per customer.
#
# NOTE: The Samsara producer service account is managed externally by Samsara.
# Its principal ID is supplied via var.customers[customerId].producer_principal
# and is referenced in acl.tf — do NOT create a confluent_service_account for it here.

resource "confluent_service_account" "consumer" {
  for_each = var.enable ? var.customers : {}

  display_name = "busie-samsara-consumer-${each.key}-${var.env}"
  description  = "Busie consumer service account for Samsara customer ${each.key} in ${var.env}"
}
