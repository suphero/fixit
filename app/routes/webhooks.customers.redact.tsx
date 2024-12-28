import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload } = await authenticate.webhook(request);
  const { shop_domain: shop } = payload;

  try {
    console.log(`Customer data deletion request received for shop: ${shop}`);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Customer redact webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
