import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/generate-reco.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const startTime = Date.now();

  try {
    const { shop, payload } = await authenticate.webhook(request);
    console.log(`Received product update webhook for shop: ${shop}, product: ${payload.id}`);

    const productId = `gid://shopify/Product/${payload.id}`;

    // Use Promise.race to timeout the publish operation after 5 seconds
    const publishPromise = publish(shop, { productId });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('RabbitMQ publish timeout')), 5000)
    );

    try {
      await Promise.race([publishPromise, timeoutPromise]);
      console.log(`Webhook processed successfully in ${Date.now() - startTime}ms`);
      return new Response(null, { status: 200 });
    } catch (publishError) {
      // Log the error but return 200 to prevent Shopify from retrying
      // The product update is not critical enough to block on MQ availability
      console.error(`Failed to publish to queue (will not retry): ${publishError}`);
      console.log(`Webhook acknowledged (MQ unavailable) in ${Date.now() - startTime}ms`);

      // Return 200 to acknowledge receipt even though MQ failed
      // This prevents webhook storms when RabbitMQ is down
      return new Response(null, { status: 200 });
    }
  } catch (error) {
    console.error("Error processing product update webhook:", error);
    const duration = Date.now() - startTime;
    console.log(`Webhook failed after ${duration}ms`);

    // Only return 500 for authentication errors, not MQ errors
    return new Response("Internal Server Error", { status: 500 });
  }
};
