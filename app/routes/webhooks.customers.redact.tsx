import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  try {
    console.log(`Customer data deletion request received for shop: ${shop}`);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Customer redact webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
