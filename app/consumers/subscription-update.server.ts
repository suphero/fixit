import { consumeFromQueue, sendToQueue } from "../mq.server";
import { unauthenticated } from "../shopify.server";
import { updateSubscription } from "../models/shop.business.server";

const QUEUE = "subscription_update";

export const publish = (
  shop: string,
  subscriptionName: string,
) => {
  return sendToQueue(QUEUE, JSON.stringify({ shop, subscriptionName }));
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
      if (!content.subscriptionName) {
        throw new Error(
          "Invalid message: 'subscriptionName' field is required.",
        );
      }

      const { session } = await unauthenticated.admin(content.shop);
      updateSubscription(session.id, content.subscriptionName);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  });
