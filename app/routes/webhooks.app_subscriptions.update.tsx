import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/subscription-update.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  console.log(`Shop: ${shop}, Payload: ${JSON.stringify(payload)}`);
  const subscriptionName = payload.name as string;
  await publish(shop, subscriptionName);
  return new Response(null, { status: 200 });
};
