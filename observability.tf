# CLoudwatch logs
resource "aws_cloudwatch_log_group" "ingest" {
  name              = "/aws/lambda/${local.ingest_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${local.worker_function_name}"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name_prefix}-api"
  retention_in_days = 14
}

# Cloudwatch Alarm
resource "aws_cloudwatch_metric_alarm" "processing_dlq_visible" {
  alarm_name        = "${local.name_prefix}-processing-dlq-visible"
  alarm_description = "There is at least one unprocessed message in the DLQ"

  namespace   = "AWS/SQS"
  metric_name = "ApproximateNumberOfMessagesVisible"
  statistic   = "Maximum"
  period      = 60

  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 1
  evaluation_periods  = 1
  datapoints_to_alarm = 1

  treat_missing_data = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.processing_dlq.name
  }

  alarm_actions = [aws_sns_topic.notifications.arn]
}