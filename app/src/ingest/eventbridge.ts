import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import type { Order } from "./types.js";

const client = new EventBridgeClient({});

export type EventBridgeAdapter = {
  publish(order: Order, requestId: string): Promise<void>;
};

export const makeEventBridgeAdapter = (eventBusName: string): EventBridgeAdapter => {
  return {
    publish: async (order, requestId) => {
      const result = await client.send(
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
        throw new Error("EventBridge rejected the event");
      }
    },
  };
};
