import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { processRequest } from "../../src/ingest/ingest.js";

const context = { awsRequestId: "lambda-request" } as Context;

function request(body: unknown): APIGatewayProxyEventV2 {
  return {
    body: JSON.stringify(body),
    isBase64Encoded: false,
    requestContext: { requestId: "api-request" },
  } as APIGatewayProxyEventV2;
}

const validOrder = {
  orderId: "pedido-001",
  customerEmail: "cliente@example.com",
  amount: "49.90",
};

describe("processRequest", () => {
  it("publica un pedido válido y devuelve 202", async () => {
    const publish = vi.fn(async () => {});
    const logger = { info: vi.fn(), error: vi.fn() };

    const result = await processRequest(request(validOrder), context, logger, {
      publish,
    });

    expect(result.statusCode).toBe(202);
    expect(JSON.parse(result.body ?? "")).toMatchObject({
      orderId: validOrder.orderId,
      requestId: "api-request",
    });
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        ...validOrder,
        createdAt: expect.any(String),
      }),
      "api-request",
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("rechaza un pedido inválido sin publicar eventos", async () => {
    const publish = vi.fn(async () => {});

    const result = await processRequest(
      request({ ...validOrder, amount: "-1" }),
      context,
      { info: vi.fn(), error: vi.fn() },
      { publish },
    );

    expect(result.statusCode).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it("devuelve 500 si EventBridge rechaza la publicación", async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const publish = vi.fn(async () => {
      throw new Error("EventBridge unavailable");
    });

    const result = await processRequest(request(validOrder), context, logger, {
      publish,
    });

    expect(result.statusCode).toBe(500);
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
