import type { SQSEvent, SQSRecord } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";
import { processBatch } from "../../src/worker/worker.js";

function record(messageId: string, body: unknown): SQSRecord {
  return { messageId, body: JSON.stringify(body) } as SQSRecord;
}

function orderEvent(orderId: string) {
  return {
    source: "lab.orders.api",
    "detail-type": "OrderSubmitted",
    id: `event-${orderId}`,
    detail: {
      orderId,
      customerEmail: "cliente@example.com",
      amount: "49.90",
      createdAt: "2026-01-01T00:00:00+00:00",
    },
  };
}

describe("processBatch", () => {
  it("reintenta solo los registros inválidos o que fallaron en DynamoDB", async () => {
    const send = vi.fn(async (order: { orderId: string }) => {
      if (order.orderId === "db-fail") {
        throw new Error("DynamoDB unavailable");
      }
      return "saved" as const;
    });
    const logger = { info: vi.fn(), error: vi.fn() };
    const event = {
      Records: [
        record("ok", orderEvent("pedido-001")),
        record("invalid", { source: "unexpected" }),
        record("failed", orderEvent("db-fail")),
      ],
    } as SQSEvent;

    const result = await processBatch(event, logger, { send });

    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: "invalid" },
      { itemIdentifier: "failed" },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "pedido-001",
        eventId: "event-pedido-001",
        processedAt: expect.any(String),
      }),
    );
  });

  it("considera procesado un pedido duplicado", async () => {
    const send = vi.fn(async () => "duplicate" as const);
    const logger = { info: vi.fn(), error: vi.fn() };
    const event = {
      Records: [record("duplicate", orderEvent("pedido-001"))],
    } as SQSEvent;

    const result = await processBatch(event, logger, { send });

    expect(result.batchItemFailures).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ message: "duplicate_ignored" }),
    );
  });
});
