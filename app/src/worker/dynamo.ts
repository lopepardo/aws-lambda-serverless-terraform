import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import type { Order } from "./types.js";

const client = new DynamoDBClient({});

export type DynamoAdapter = {
  send: (order: Order) => Promise<"saved" | "duplicate">;
};

export const makeDynamoAdapter = (tableName: string): DynamoAdapter => {
  return {
    send: async (order: Order) => {
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
        return "saved";
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "ConditionalCheckFailedException"
        ) {
          return "duplicate";
        }
        throw error;
      }
    },
  };
};
