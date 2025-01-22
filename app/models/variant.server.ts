import { authenticate } from "../shopify.server";
import * as business from "./variant.business.server";

export async function getDetails(request: Request, id: string) {
  const { admin } = await authenticate.admin(request);
  return business.getDetails(admin.graphql, id);
}

export async function getSalesMetrics(request: Request, id: string) {
  const { session } = await authenticate.admin(request);
  return business.getSalesMetricsForUser(session.shop, id);
}
