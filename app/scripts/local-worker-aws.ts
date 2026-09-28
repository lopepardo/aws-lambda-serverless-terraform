import type { Context } from "aws-lambda";
import { makeWorkerEvent } from "./worker-event.js";

if (!process.env.TABLE_NAME) {
  throw new Error("Define TABLE_NAME para usar DynamoDB real");
}

const { handler } = await import("../src/worker/index.js");
const result = await handler(
  makeWorkerEvent(`local-worker-${Date.now()}`),
  { awsRequestId: "local-worker-aws" } as Context,
  () => {},
);

console.log(result);
if (!result || result.batchItemFailures.length > 0) process.exitCode = 1;
