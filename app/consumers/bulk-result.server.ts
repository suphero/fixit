import { consumeFromQueue, sendToQueue } from "../mq.server";
import { processBulkOperationResult } from "../models/variant.business.server";

const QUEUE = "bulk_result";

export const publish = (url: string, shop: string) => {
  return sendToQueue(QUEUE, JSON.stringify({ url, shop }));
};

export const consume = () =>
  consumeFromQueue(QUEUE, async (message) => {
    try {
      if (!message?.content) {
        throw new Error("Invalid message: 'content' field is required.");
      }
      const { url, shop } = JSON.parse(message.content.toString());
      if (!url || !shop) {
        throw new Error("Invalid message: 'url' and 'shop' fields are required.");
      }

      await processBulkOperationResult(url, shop);
    } catch (error) {
      console.error("Error processing bulk operation result:", error);
    }
  });
