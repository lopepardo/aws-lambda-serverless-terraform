# Ingest lambda
data "archive_file" "ingest" {
  type             = "zip"
  source_file      = "${path.module}/app/build/ingest/index.cjs"
  output_path      = "${path.module}/app/build/ingest/ingest.zip"
  output_file_mode = "0666"
}

resource "aws_lambda_function" "ingest" {
  function_name = local.ingest_function_name
  role          = aws_iam_role.ingest.arn

  filename         = data.archive_file.ingest.output_path
  source_code_hash = data.archive_file.ingest.output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs24.x"
  architectures = ["arm64"]

  memory_size = 256
  timeout     = 5
  # reserved_concurrent_executions = 10

  environment {
    variables = {
      "EVENT_BUS_NAME" = aws_cloudwatch_event_bus.orders.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ingest,
    aws_iam_role_policy.ingest
  ]
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_apigatewayv2_api.orders.execution_arn}/${aws_apigatewayv2_stage.env.name}/POST/orders"
}

# Worker lambda
data "archive_file" "worker" {
  type             = "zip"
  source_file      = "${path.module}/app/build/worker/index.cjs"
  output_path      = "${path.module}/app/build/worker/worker.zip"
  output_file_mode = "0666"
}

resource "aws_lambda_function" "worker" {
  function_name = local.worker_function_name
  role          = aws_iam_role.worker.arn

  filename         = data.archive_file.worker.output_path
  source_code_hash = data.archive_file.worker.output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs24.x"
  architectures = ["arm64"]

  memory_size = 256
  timeout     = 10
  # reserved_concurrent_executions = 5

  environment {
    variables = {
      APP_ENV    = local.environment
      TABLE_NAME = aws_dynamodb_table.orders.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.worker,
    aws_iam_role_policy.worker
  ]
}

resource "aws_lambda_event_source_mapping" "worker" {
  event_source_arn = aws_sqs_queue.processing.arn
  function_name    = aws_lambda_function.worker.arn
  enabled          = true

  batch_size                         = 10
  maximum_batching_window_in_seconds = 0
  function_response_types            = ["ReportBatchItemFailures"]

  scaling_config {
    maximum_concurrency = 5
  }

  depends_on = [aws_iam_role_policy.worker]
}