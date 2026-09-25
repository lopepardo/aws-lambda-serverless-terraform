import { z } from "zod";
import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSRecord,
} from "aws-lambda";

import type { DynamoAdapter } from "./dynamo.js";
import type { Order } from "./types.js";
import type { Logger } from "./logger.js";

const OrderEventSchema = z.object({
  source: z.literal("lab.orders.api"),
  "detail-type": z.literal("OrderSubmitted"),
  id: z.unknown().optional(),
  detail: z.object({
    orderId: z.string().min(1),
    customerEmail: z.string().includes("@"),
    amount: z.string().min(1),
    createdAt: z.string().min(1),
  }),
});

function orderFromRecord(record: SQSRecord): Order {
  const envelope = OrderEventSchema.parse(JSON.parse(record.body));
  const { detail } = envelope;

  return {
    orderId: detail.orderId,
    customerEmail: detail.customerEmail,
    amount: detail.amount,
    createdAt: detail.createdAt,
    processedAt: new Date().toISOString().replace(/Z$/, "+00:00"),
    eventId: typeof envelope.id === "string" ? envelope.id : "unknown",
  };
}

export async function processBatch(
  event: SQSEvent,
  logger: Logger,
  dynamoClient: DynamoAdapter,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    let order: Order;
    try {
      order = orderFromRecord(record);
    } catch (error) {
      logger.error(
        { message: "record_failed", sqsMessageId: record.messageId },
        error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      const result = await dynamoClient.send(order);
      if (result === "saved") {
        logger.info({
          message: "order_persisted",
          orderId: order.orderId,
          sqsMessageId: record.messageId,
        });
      } else if (result === "duplicate") {
        logger.info({
          message: "duplicate_ignored",
          sqsMessageId: record.messageId,
        });
      }
    } catch (error) {
      logger.error(
        { message: "aws_error", sqsMessageId: record.messageId },
        error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
