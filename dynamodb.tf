resource "aws_dynamodb_table" "orders" {
  name         = "${local.name_prefix}-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }

  # deletion_protection_enabled = true

  # point_in_time_recovery {
  #   enabled = true
  #   recovery_period_in_days = 35
  # }
}