import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/generate-reco.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, payload } = await authenticate.webhook(request);
    console.log(`Received product update webhook for shop: ${shop}, product: ${payload.id}`);

    const productId = `gid://shopify/Product/${payload.id}`;
    await publish(shop, { productId });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error processing product update webhook:", error);
    // Returning 500 so Shopify retries
    return new Response("Internal Server Error", { status: 500 });
  }
};
