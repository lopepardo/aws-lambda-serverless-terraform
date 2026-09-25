output "orders_endpoint" {
  description = "Endpoint for creating orders"
  value       = "${aws_apigatewayv2_stage.env.invoke_url}/orders"
}

output "orders_table_name" {
  description = "Order table name"
  value       = aws_dynamodb_table.orders.name
}

output "processing_queue_url" {
  description = "Processing queue url"
  value       = aws_sqs_queue.processing.url
}