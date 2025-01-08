import type { Subscription } from "@prisma/client";
import { consumeFromQueue, sendToQueue } from "../mq.server";
import { unauthenticated } from "../shopify.server";
import { updateSubscription } from "../models/shop.business.server";

const QUEUE = "subscription_update";

export const publish = (
  shop: string,
  subscriptionName: string,
  subscriptionStatus: string,
) => {
  return sendToQueue(
    QUEUE,
    JSON.stringify({ shop, subscriptionName, subscriptionStatus }),
  );
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
      if (!content.subscriptionStatus) {
        throw new Error(
          "Invalid message: 'subscriptionStatus' field is required.",
        );
      }

      let subscription: Subscription;
      if (
        content.subscriptionName === "Premium" &&
        content.subscriptionStatus === "ACTIVE"
      ) {
        subscription = "PREMIUM";
      } else {
        subscription = "FREE";
      }

      const { session } = await unauthenticated.admin(content.shop);
      updateSubscription(session.id, subscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  });
