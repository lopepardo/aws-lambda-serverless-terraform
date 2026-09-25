locals {
  # General
  project_name = "lambda-serverless"
  environment  = "dev"
  aws_region   = data.aws_region.current.region
  account_id   = data.aws_caller_identity.current.account_id
  name_prefix  = "${local.project_name}-${local.environment}"

  ingest_function_name = "${local.name_prefix}-ingest-fn"
  worker_function_name = "${local.name_prefix}-worker-fn"

  tags = {
    Project     = local.project_name
    Environment = local.environment
    ManagedBy   = "Terraform"
  }
}