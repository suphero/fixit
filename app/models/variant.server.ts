import { authenticate } from "../shopify.server";
import * as business from "./variant.business.server";

export async function getDetails(request: Request, id: string) {
  const { admin } = await authenticate.admin(request);
  return business.getDetails(admin.graphql, id);
}

export async function getVariantMetrics(request: Request, id: string) {
  const { session } = await authenticate.admin(request);
  return business.getVariantMetricsForUser(session.shop, id);
}
