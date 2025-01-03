import { consumeFromQueue, sendToQueue } from "../mq.server";
import { unauthenticated } from "../shopify.server";
import { updateScope } from "../models/session.business.server";

const QUEUE = "scopes_update";

export const publish = (
  shop: string,
  scopes: string[],
) => {
  return sendToQueue(QUEUE, JSON.stringify({ shop, scopes }));
};

export const consume = () =>
  consumeFromQueue(QUEUE, async (message) => {
    try {
      if (!message?.content) {
        throw new Error("Invalid message: 'content' field is required.");
      }
      const content = JSON.parse(message.content.toString());
      if (!content.shop) {
        throw new Error("Invalid message: 'shop' field is required.");
      }
      if (!content.scopes) {
        throw new Error("Invalid message: 'scopes' field is required.");
      }

      const { session } = await unauthenticated.admin(content.shop);
      updateScope(session.id, content.scopes);
    } catch (error) {
      console.error("Error generating recommendations:", error);
    }
  });
