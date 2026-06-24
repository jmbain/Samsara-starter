terraform {
  required_version = "~>1.0.4"
  required_providers {
    confluent = {
      source  = "confluentinc/confluent"
      version = "~>2.58.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~>5.94.1"
    }
  }

  backend "remote" {
    organization = "busie-inc"

    workspaces {
      prefix = "samsara-use1-"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Env       = var.env
      ManagedBy = "Terraform"
      Project   = var.name
    }
  }
}

provider "confluent" {}
