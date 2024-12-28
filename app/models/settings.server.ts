import type { Settings } from "@prisma/client";
import { authenticate } from "../shopify.server";
import * as business from "./settings.business.server";

export async function getShopSettings(request: Request): Promise<Settings> {
  const { session } = await authenticate.admin(request);
  return business.getShopSettings(session.shop);
}

export async function updateShopSettings(
  request: Request,
  settings: Partial<Settings>
): Promise<Settings> {
  const { admin, session } = await authenticate.admin(request);
  return business.updateShopSettings(admin.graphql, session.shop, settings);
}
