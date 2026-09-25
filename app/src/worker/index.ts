import type { SQSHandler } from "aws-lambda";
import { processBatch } from "./worker.js";
import { makeDynamoAdapter } from "./dynamo.js";
import { env } from "./env.js";
import { makeLogger } from "./logger.js";

const dynamoAdapter = makeDynamoAdapter(env.DYNAMO.TABLE_NAME);
const logger = makeLogger();

export const handler: SQSHandler = (event) => {
  return processBatch(event, logger, dynamoAdapter);
};
