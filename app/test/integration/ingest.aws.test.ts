import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";

it("publica un pedido en el bus real de EventBridge", async () => {
  if (!process.env.EVENT_BUS_NAME) {
    throw new Error("Define EVENT_BUS_NAME para esta prueba");
  }

  const { handler } = await import("../../src/ingest/index.js");
  const orderId = `test-${randomUUID()}`;
  const event = {
    body: JSON.stringify({
      orderId,
      customerEmail: "cliente@example.com",
      amount: "49.90",
    }),
    isBase64Encoded: false,
    requestContext: { requestId: `integration-${orderId}` },
  } as APIGatewayProxyEventV2;

  const result = await handler(
    event,
    { awsRequestId: `integration-${orderId}` } as Context,
    () => {},
  );

  expect(result).toMatchObject({ statusCode: 202 });
});
