import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getBulkOperationUrl } from "../models/variant.business.server";
import { publish as publishBulkResult } from "../consumers/bulk-result.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, admin, payload } = await authenticate.webhook(request);
    console.log(`Received bulk_operations/finish webhook for shop: ${shop}, status: ${payload.status}`);

    if (payload.status === 'completed' && !payload.error_code && admin) {
      const url = await getBulkOperationUrl(admin.graphql, payload.admin_graphql_api_id);
      if (url) {
        await publishBulkResult(url, shop);
      }
    } else if (payload.error_code) {
      console.error(`Bulk operation failed for ${shop} with error: ${payload.error_code}`);
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error processing bulk operation webhook:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
