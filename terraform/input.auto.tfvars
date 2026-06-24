region = "us-east-1"
name   = "wp"
env    = "dev"

# Add real customer IDs as they are onboarded via POST /api/samsara/onboard.
# The producer_principal is the Confluent service account principal Samsara provides
# when they provision their Kafka connector for this customer.
# Example:
# customers = {
#   "cust_001" = { producer_principal = "User:sa-abc123" }
#   "cust_002" = { producer_principal = "User:sa-def456" }
# }
customers = {}
