import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { processRequest } from "./ingest.js";
import { makeEventBridgeAdapter } from "./eventbridge.js";
import { env } from "./env.js";
import { makeLogger } from "./logger.js";

const eventBridgeAdapter = makeEventBridgeAdapter(env.EVENTBRIDGE.EVENT_BUS_NAME);
const logger = makeLogger();

export const handler: APIGatewayProxyHandlerV2 = (event, context) => {
  return processRequest(event, context, logger, eventBridgeAdapter);
};
