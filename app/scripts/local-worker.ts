import { processBatch } from "../src/worker/worker.js";
import { makeLogger } from "../src/worker/logger.js";
import { makeWorkerEvent } from "./worker-event.js";

const result = await processBatch(
  makeWorkerEvent("local-worker-001"),
  makeLogger(),
  {
    send: async (order) => {
      console.log("DynamoDB simulado:", order);
      return "saved";
    },
  },
);

console.log(result);
if (result.batchItemFailures.length > 0) process.exitCode = 1;
