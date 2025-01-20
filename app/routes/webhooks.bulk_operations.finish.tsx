import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getBulkOperationUrl, processBulkOperationResult } from "../models/variant.business.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload } = await authenticate.webhook(request);
  console.log(`Bulk operation finished for shop: ${shop}`);

  if (payload.status === 'completed' && !payload.error_code && admin) {
    const url = await getBulkOperationUrl(admin.graphql, payload.admin_graphql_api_id);
    if (url) {
      await processBulkOperationResult(url, shop);
    }
  }

  return new Response(null, { status: 200 });
};
