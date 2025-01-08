import { consumeFromQueue, sendToQueue } from "../mq.server";
import { unauthenticated } from "../shopify.server";
import { updateSubscription } from "../models/shop.business.server";

const QUEUE = "subscription_update";

export const publish = (
  shop: string,
  subscriptionId: string,
  subscriptionName: string,
  subscriptionStatus: string,
) => {
  return sendToQueue(
    QUEUE,
    JSON.stringify({
      shop,
      subscriptionId,
      subscriptionName,
      subscriptionStatus,
    }),
  );
};

export const consume = () =>
  consumeFromQueue(QUEUE, async (message) => {
    try {
      if (!message?.content) {
        throw new Error("Invalid message: 'content' field is required.");
      }
      const content = JSON.parse(message.content.toString());

      const { session } = await unauthenticated.admin(content.shop);
      updateSubscription(
        session.id,
        content.subscriptionId,
        content.subscriptionName,
        content.subscriptionStatus,
      );
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  });
