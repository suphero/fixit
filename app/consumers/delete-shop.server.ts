import { consumeFromQueue, sendToQueue } from "../mq.server";
import { deleteRecommendations } from "../models/recommendation.business.server";
import { deleteSettings } from "../models/settings.business.server";
import { deleteSession } from "../models/session.business.server";

const QUEUE = "delete_shop";

export const publish = (shop: string) => {
  return sendToQueue(QUEUE, JSON.stringify({ shop }));
}

export const consume = () =>
  consumeFromQueue(QUEUE, async (message) => {
    try {
      if (!message?.content) {
        throw new Error("Invalid message: 'content' field is required.");
      }
      const { shop } = JSON.parse(message.content.toString());
      if (!shop) {
        throw new Error("Invalid message: 'shop' field is required.");
      }

      console.log(`Starting deletion process for shop: ${shop}`);

      await deleteRecommendations(shop);
      await deleteSettings(shop);
      await deleteSession(shop);

      console.log(`All data for shop: ${shop} has been deleted.`);
    } catch (error) {
      console.error("Error deleting shop data:", error);
    }
  });
