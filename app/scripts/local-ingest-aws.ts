import type { APIGatewayProxyEventV2, Context } from "aws-lambda";

if (!process.env.EVENT_BUS_NAME) {
  throw new Error("Define EVENT_BUS_NAME para usar EventBridge real");
}

const { handler } = await import("../src/ingest/index.js");
const event = {
  body: JSON.stringify({
    orderId: `local-${Date.now()}`,
    customerEmail: "cliente@example.com",
    amount: "49.90",
  }),
  isBase64Encoded: false,
  requestContext: { requestId: "local-2" },
} as APIGatewayProxyEventV2;

const result = await handler(
  event,
  { awsRequestId: "local-2" } as Context,
  () => {},
);

console.log(result);
if (!result || typeof result !== "object" || result.statusCode !== 202) {
  process.exitCode = 1;
}
