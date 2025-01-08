import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/subscription-update.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  console.log(`Shop: ${shop}, Payload: ${JSON.stringify(payload)}`);
  const subscriptionId = payload.app_subscription.admin_graphql_api_id;
  const subscriptionName = payload.app_subscription.name;
  const subscriptionStatus = payload.app_subscription.status;
  await publish(shop, subscriptionId, subscriptionName, subscriptionStatus);
  return new Response(null, { status: 200 });
};
