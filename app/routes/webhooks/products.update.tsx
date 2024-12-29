import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server";
import { initializeAll } from "app/models/recommendation.business.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, payload } = await authenticate.webhook(request);
  if (!admin) {
    return new Response(null, { status: 200 });
  }

  try {
    await initializeAll(admin.graphql, shop, { productId: payload.id });
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Product create webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
