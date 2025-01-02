import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/generate-reco.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, shop, payload } = await authenticate.webhook(request);
  if (!admin) {
    return new Response(null, { status: 200 });
  }

  const productId = `gid://shopify/Product/${payload.id}`;
  await publish(shop, { productId });
  return new Response(null, { status: 200 });
};
