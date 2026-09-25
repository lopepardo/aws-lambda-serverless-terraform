terraform {
  required_version = ">= 1.10, < 2.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"

  # assume_role {
  #   role_arn = "arn:aws:iam::ACCOUNT_ID:role/TerraformDeployRole"
  # }

  default_tags {
    tags = local.tags
  }
}