import { z } from "zod";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

import type { EventBridgeAdapter } from "./eventbridge.js";
import type { Logger } from "./logger.js";
import type { Order } from "./types.js";

const MAX_BODY_BYTES = 64 * 1024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

const OrderInputSchema = z.object({
  orderId: z.string().regex(ORDER_ID_PATTERN),
  customerEmail: z.string().includes("@").max(320),
  amount: z
    .string()
    .trim()
    .regex(DECIMAL_PATTERN)
    .refine((value) => Number(value) > 0 && Number(value) <= 1_000_000),
});

class BadRequestError extends Error {}

function response(
  statusCode: number,
  payload: object,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function requestBody(event: APIGatewayProxyEventV2): unknown {
  const rawBody = event.body ?? "";
  const bodyBytes = Buffer.from(
    rawBody,
    event.isBase64Encoded ? "base64" : "utf8",
  );

  if (bodyBytes.length > MAX_BODY_BYTES) {
    throw new BadRequestError("Request body exceeds 64 KiB");
  }

  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes),
    );
  } catch {
    throw new BadRequestError("Request body must be valid UTF-8 JSON");
  }
}

export async function processRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  logger: Logger,
  eventBridgeAdapter: EventBridgeAdapter,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId =
    event.requestContext?.requestId || context.awsRequestId || "unknown";

  try {
    const input = OrderInputSchema.parse(requestBody(event));
    const order: Order = {
      ...input,
      createdAt: new Date().toISOString().replace(/Z$/, "+00:00"),
    };
    await eventBridgeAdapter.publish(order, requestId);
    logger.info({
      message: "order_submitted",
      orderId: order.orderId,
      requestId,
    });
    return response(202, {
      message: "Order accepted for processing",
      orderId: order.orderId,
      requestId,
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return response(400, { message: error.message, requestId });
    }
    if (error instanceof z.ZodError) {
      const field = error.issues[0]?.path.join(".") || "order";
      return response(400, { message: `Invalid ${field}`, requestId });
    }
    logger.error({ message: "submit_failed", requestId }, error);
    return response(500, {
      message: "Unable to accept the order",
      requestId,
    });
  }
}
