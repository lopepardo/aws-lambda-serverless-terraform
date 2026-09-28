import type { SQSEvent } from "aws-lambda";

export function makeWorkerEvent(orderId: string): SQSEvent {
  const now = new Date().toISOString();
  const body = JSON.stringify({
    version: "0",
    id: `event-${orderId}`,
    "detail-type": "OrderSubmitted",
    source: "lab.orders.api",
    account: "000000000000",
    time: now,
    region: "us-east-1",
    resources: [],
    detail: {
      orderId,
      customerEmail: "cliente@example.com",
      amount: "49.90",
      createdAt: now,
    },
  });

  return {
    Records: [
      {
        messageId: `message-${orderId}`,
        receiptHandle: "local",
        body,
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: String(Date.now()),
          SenderId: "local",
          ApproximateFirstReceiveTimestamp: String(Date.now()),
        },
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:000000000000:local",
        awsRegion: "us-east-1",
      },
    ],
  };
}
