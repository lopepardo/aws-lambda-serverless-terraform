import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import type {
  SQSBatchItemFailure,
  SQSBatchResponse,
  SQSEvent,
  SQSHandler,
  SQSRecord,
} from "aws-lambda";

type Order = {
  orderId: string;
  customerEmail: string;
  amount: string;
  createdAt: string;
  processedAt: string;
  eventId: string;
};

type DynamoWriter = {
  send(command: PutItemCommand): Promise<unknown>;
};

const dynamodb = new DynamoDBClient({});
const decimalPattern = /^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveAmount(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("amount inválido");
  }
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  ) {
    throw new Error("amount inválido");
  }

  const amount = String(value).trim();
  const significand = amount.split(/[eE]/, 1)[0] ?? "";
  if (!decimalPattern.test(amount) || !/[1-9]/.test(significand)) {
    throw new Error("amount inválido");
  }

  // Keep the decimal digits instead of converting them to a JavaScript number.
  return amount
    .replace(/^\+/, "")
    .replace(/^\./, "0.")
    .replace(/^0+(?=\d)/, "")
    .replace(/\.(?=[eE]|$)/, "");
}

function orderFromRecord(record: SQSRecord): Order {
  const envelope: unknown = JSON.parse(record.body);
  if (!isObject(envelope) || envelope.source !== "lab.orders.api") {
    throw new Error("source no reconocido");
  }
  if (envelope["detail-type"] !== "OrderSubmitted") {
    throw new Error("detail-type no reconocido");
  }

  const detail = envelope.detail;
  if (!isObject(detail)) {
    throw new Error("detail inválido");
  }

  const orderId = detail.orderId;
  const customerEmail = detail.customerEmail;
  const createdAt = detail.createdAt;
  if (typeof orderId !== "string" || !orderId) {
    throw new Error("orderId ausente");
  }
  if (typeof customerEmail !== "string" || !customerEmail.includes("@")) {
    throw new Error("customerEmail inválido");
  }
  if (typeof createdAt !== "string" || !createdAt) {
    throw new Error("createdAt ausente");
  }

  return {
    orderId,
    customerEmail,
    amount: positiveAmount(detail.amount),
    createdAt,
    processedAt: new Date().toISOString().replace(/Z$/, "+00:00"),
    eventId: typeof envelope.id === "string" ? envelope.id : "unknown",
  };
}

export async function processBatch(
  event: SQSEvent,
  client: DynamoWriter,
  tableName: string,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    let order: Order;
    try {
      order = orderFromRecord(record);
    } catch (error) {
      console.error(
        JSON.stringify({ message: "record_failed", sqsMessageId: record.messageId }),
        error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
      continue;
    }

    try {
      await client.send(
        new PutItemCommand({
          TableName: tableName,
          Item: {
            orderId: { S: order.orderId },
            customerEmail: { S: order.customerEmail },
            amount: { N: order.amount },
            status: { S: "RECEIVED" },
            createdAt: { S: order.createdAt },
            processedAt: { S: order.processedAt },
            eventId: { S: order.eventId },
          },
          ConditionExpression: "attribute_not_exists(orderId)",
        }),
      );
      console.info(
        JSON.stringify({
          message: "order_persisted",
          orderId: order.orderId,
          sqsMessageId: record.messageId,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        console.info(
          JSON.stringify({ message: "duplicate_ignored", sqsMessageId: record.messageId }),
        );
        continue;
      }

      console.error(
        JSON.stringify({ message: "aws_error", sqsMessageId: record.messageId }),
        error,
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

export const handler: SQSHandler = (event) => {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) {
    throw new Error("TABLE_NAME no configurada");
  }
  return processBatch(event, dynamodb, tableName);
};
