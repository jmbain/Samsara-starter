variable "region" {
  type        = string
  description = "AWS region for infrastructure provisioning"
}

variable "name" {
  type        = string
  description = "Project name (e.g. wp)"
}

variable "env" {
  type        = string
  description = "Environment name (e.g. dev, prod)"
}

variable "enable" {
  type        = bool
  description = "Flag to enable resource creation"
  default     = true
}

variable "customers" {
  type = map(object({
    producer_principal = string
  }))
  description = <<EOF
    Map of Samsara customer IDs to their Confluent producer service account principal.
    The producer SA is managed externally by Samsara — do not create it here.
    Example:
    {
      "cust_001" = { producer_principal = "User:sa-abc123" }
    }
  EOF
  default = {}
}
