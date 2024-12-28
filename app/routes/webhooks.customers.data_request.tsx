import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload } = await authenticate.webhook(request);
  const { shop_domain: shop } = payload;

  try {
    const response = {
      shop,
      timestamp: new Date().toISOString(),
      dataPresent: false,
      data: {},
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Customer data request webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
