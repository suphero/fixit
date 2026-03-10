import type { RecommendationSubType, RecommendationType } from "@prisma/client";
import { consumeFromQueue, sendToQueue } from "../mq.server";
import { generateRecommendations } from "../models/recommendation.business.server";
import { unauthenticated } from "../shopify.server";

const QUEUE = "generate_reco";

export const publish = (
  shop: string,
  params: {
    productId?: string;
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
    premium?: boolean;
  } = {},
) => {
  return sendToQueue(QUEUE, JSON.stringify({ shop, params }));
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

      const { admin } = await unauthenticated.admin(content.shop);
      await generateRecommendations(admin.graphql, content.shop, content.params);
    } catch (error) {
      console.error("Error generating recommendations:", error);
    }
  });
