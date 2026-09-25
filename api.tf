resource "aws_apigatewayv2_api" "orders" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "ingest" {
  api_id = aws_apigatewayv2_api.orders.id

  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.ingest.invoke_arn

  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "create_order" {
  api_id = aws_apigatewayv2_api.orders.id

  route_key          = "POST /orders"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.ingest.id}"
}

resource "aws_apigatewayv2_stage" "env" {
  api_id = aws_apigatewayv2_api.orders.id
  name   = local.environment

  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn

    format = jsonencode({
      requestId        = "$context.requestId"
      sourceIp         = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  route_settings {
    route_key              = aws_apigatewayv2_route.create_order.route_key
    throttling_rate_limit  = 20
    throttling_burst_limit = 40
  }
}