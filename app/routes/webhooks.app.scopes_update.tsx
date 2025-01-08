import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { publish } from "../consumers/scopes-update.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, shop } = await authenticate.webhook(request);
    const current = payload.current as string[];
    await publish(shop, current);
    return new Response(null, { status: 200 });
};
