resource "aws_cloudwatch_event_bus" "orders" {
  name = "${local.name_prefix}-bus"
}

resource "aws_cloudwatch_event_rule" "order_submitted" {
  name           = "${local.name_prefix}-order-submitted"
  event_bus_name = aws_cloudwatch_event_bus.orders.name

  event_pattern = jsonencode({
    source      = ["lab.orders.api"]
    detail-type = ["OrderSubmitted"]
  })
}

resource "aws_cloudwatch_event_target" "processing_queue" {
  event_bus_name = aws_cloudwatch_event_bus.orders.name
  rule           = aws_cloudwatch_event_rule.order_submitted.name
  target_id      = "ProcessingQueue"
  arn            = aws_sqs_queue.processing.arn

  retry_policy {
    maximum_event_age_in_seconds = 1 * 24 * 60 * 60
    maximum_retry_attempts       = 185
  }

  dead_letter_config {
    arn = aws_sqs_queue.eventbridge_dlq.arn
  }

  depends_on = [
    aws_sqs_queue.processing,
    aws_sqs_queue.eventbridge_dlq
  ]
}

resource "aws_cloudwatch_event_target" "notification" {
  event_bus_name = aws_cloudwatch_event_bus.orders.name
  rule           = aws_cloudwatch_event_rule.order_submitted.name
  target_id      = "NotificationTopic"
  arn            = aws_sns_topic.notifications.arn

  input_transformer {
    input_paths = {
      orderId   = "$.detail.orderId"
      amount    = "$.detail.amount"
      createdAt = "$.detail.createdAt"
    }

    input_template = "\"Pedido <orderId> recibido por un valor de <amount> en <createdAt>.\""
  }

  retry_policy {
    maximum_event_age_in_seconds = 1 * 24 * 60 * 60
    maximum_retry_attempts       = 185
  }

  dead_letter_config {
    arn = aws_sqs_queue.eventbridge_dlq.arn
  }

  depends_on = [
    aws_sns_topic_policy.notifications,
    aws_sqs_queue_policy.eventbridge_dlq
  ]
}