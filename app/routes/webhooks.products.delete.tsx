import type { ActionFunctionArgs } from "@remix-run/node";
import { RecommendationStatus } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const productId = `gid://shopify/Product/${payload.id}`;

  try {
    await db.recommendation.deleteMany({
      where: {
        shop,
        productId,
        status: RecommendationStatus.PENDING
      },
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Product delete webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
