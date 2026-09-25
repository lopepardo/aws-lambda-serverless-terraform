import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { PutEventsCommandOutput } from "@aws-sdk/client-eventbridge";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

const MAX_BODY_BYTES = 64 * 1024;
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const DECIMAL_PATTERN = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

type EventPublisher = {
  send(command: PutEventsCommand): Promise<Pick<PutEventsCommandOutput, "FailedEntryCount" | "Entries">>;
};

type Order = {
  orderId: string;
  customerEmail: string;
  amount: string;
  createdAt: string;
};

class BadRequestError extends Error {}

const eventBridge = new EventBridgeClient({});

function response(statusCode: number, payload: object): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  const rawBody = event.body ?? "";
  let bodyBytes: Buffer;

  if (event.isBase64Encoded) {
    if (BASE64_PATTERN.exec(rawBody)?.[0] !== rawBody) {
      throw new BadRequestError("El cuerpo debe ser base64 válido");
    }
    bodyBytes = Buffer.from(rawBody, "base64");
  } else {
    bodyBytes = Buffer.from(rawBody, "utf8");
  }

  if (bodyBytes.length > MAX_BODY_BYTES) {
    throw new BadRequestError("El cuerpo supera 64 KiB");
  }

  let bodyText: string;
  try {
    bodyText = event.isBase64Encoded
      ? new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes)
      : rawBody;
  } catch {
    throw new BadRequestError("El cuerpo debe ser UTF-8 válido");
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new BadRequestError("El cuerpo debe ser JSON válido");
  }

  if (!isObject(body)) {
    throw new BadRequestError("El cuerpo JSON debe ser un objeto");
  }
  return body;
}

/** Preserve ASCII decimal digits and scale in fixed notation for EventBridge. */
function normalizedAmount(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new BadRequestError("amount debe ser numérico");
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new BadRequestError("amount debe ser numérico");
  }

  const input = String(value).trim().replaceAll("_", "");
  const match = DECIMAL_PATTERN.exec(input);
  if (!match) {
    throw new BadRequestError("amount debe ser numérico");
  }

  const integer = match[2] ?? "";
  const fraction = match[3] ?? match[4] ?? "";
  const digits = integer + fraction;
  const firstNonZero = digits.search(/[1-9]/);
  if (match[1] === "-" || firstNonZero < 0) {
    throw new BadRequestError("amount debe ser mayor que 0 y menor o igual a 1000000");
  }

  const exponent = Number(match[5] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    throw new BadRequestError("amount debe ser numérico");
  }

  const decimalPoint = integer.length + exponent;
  const integerDigits = decimalPoint - firstNonZero;
  const significant = digits.slice(firstNonZero);
  if (
    integerDigits > 7 ||
    (integerDigits === 7 &&
      (significant.slice(0, 7).padEnd(7, "0") !== "1000000" ||
        /[1-9]/.test(significant.slice(7))))
  ) {
    throw new BadRequestError("amount debe ser mayor que 0 y menor o igual a 1000000");
  }

  // An exponent must not expand a small request into a huge EventBridge detail.
  const outputLength =
    decimalPoint <= 0
      ? 2 - decimalPoint + digits.length
      : decimalPoint >= digits.length
        ? decimalPoint
        : digits.length + 1;
  if (outputLength > MAX_BODY_BYTES) {
    throw new BadRequestError("amount debe ser numérico");
  }

  const fixed =
    decimalPoint <= 0
      ? `0.${"0".repeat(-decimalPoint)}${digits}`
      : decimalPoint >= digits.length
        ? `${digits}${"0".repeat(decimalPoint - digits.length)}`
        : `${digits.slice(0, decimalPoint)}.${digits.slice(decimalPoint)}`;
  return fixed.replace(/^0+(?=\d)/, "");
}

function validatedOrder(body: Record<string, unknown>): Order {
  const orderId = body.orderId;
  const customerEmail = body.customerEmail;

  if (typeof orderId !== "string" || ORDER_ID_PATTERN.exec(orderId)?.[0] !== orderId) {
    throw new BadRequestError(
      "orderId es obligatorio y admite 1-64 letras, números, guion o guion bajo",
    );
  }
  if (
    typeof customerEmail !== "string" ||
    !customerEmail.includes("@") ||
    [...customerEmail].length > 320
  ) {
    throw new BadRequestError("customerEmail no tiene un formato válido");
  }

  return {
    orderId,
    customerEmail,
    amount: normalizedAmount(body.amount),
    createdAt: new Date().toISOString().replace(/Z$/, "+00:00"),
  };
}

export async function processRequest(
  event: APIGatewayProxyEventV2,
  context: Context,
  publisher: EventPublisher,
  eventBusName: string | undefined,
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestId = event.requestContext?.requestId || context.awsRequestId || "unknown";

  try {
    const order = validatedOrder(requestBody(event));
    if (!eventBusName) {
      throw new Error("EVENT_BUS_NAME no configurado");
    }

    const result = await publisher.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "lab.orders.api",
            DetailType: "OrderSubmitted",
            Detail: JSON.stringify({ ...order, requestId }),
            EventBusName: eventBusName,
          },
        ],
      }),
    );
    if (result.FailedEntryCount !== 0 || !result.Entries?.[0]?.EventId) {
      throw new Error("EventBridge rechazó el evento");
    }

    console.info(JSON.stringify({ message: "order_submitted", orderId: order.orderId, requestId }));
    return response(202, {
      message: "Pedido aceptado para procesamiento",
      orderId: order.orderId,
      requestId,
    });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return response(400, { message: error.message, requestId });
    }
    console.error(JSON.stringify({ message: "submit_failed", requestId }), error);
    return response(500, { message: "No fue posible aceptar el pedido", requestId });
  }
}

export const handler: APIGatewayProxyHandlerV2 = (event, context) =>
  processRequest(event, context, eventBridge, process.env.EVENT_BUS_NAME);
