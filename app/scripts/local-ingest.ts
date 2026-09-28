import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { processRequest } from "../src/ingest/ingest.js";
import { makeLogger } from "../src/ingest/logger.js";

const event = {
  body: JSON.stringify({
    orderId: "local-001",
    customerEmail: "cliente@example.com",
    amount: "49.90",
  }),
  isBase64Encoded: false,
  requestContext: { requestId: "local-1" },
} as APIGatewayProxyEventV2;

const result = await processRequest(
  event,
  { awsRequestId: "local-1" } as Context,
  makeLogger(),
  {
    publish: async (order) => {
      console.log("Evento simulado:", order);
    },
  },
);

console.log(result.statusCode, result.body);
if (result.statusCode !== 202) process.exitCode = 1;
