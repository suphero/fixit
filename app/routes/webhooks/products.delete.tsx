import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const productId = `gid://shopify/Product/${payload.id}`;

  try {
    await db.recommendation.deleteMany({
      where: {
        shop,
        OR: [
          { productId },
          {
            AND: [
              { targetType: "PRODUCT_VARIANT" },
              { productId },
            ],
          },
        ],
      },
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Product delete webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
