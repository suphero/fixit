import type { Shop } from "@prisma/client";
import { authenticate } from "../shopify.server";
import * as business from "./shop.business.server";

export async function getShop(request: Request): Promise<Shop> {
  const { session } = await authenticate.admin(request);
  return business.getShop(session.shop);
}
