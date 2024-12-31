import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { deleteRecommendations } from "../models/recommendation.business.server";
import { deleteSettings } from "../models/settings.business.server";
import { deleteSession } from "../models/session.business.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  await Promise.all([
    deleteRecommendations(shop),
    deleteSettings(shop),
    deleteSession(shop),
  ]);

  return new Response(null, { status: 200 });
};
