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
  const { session } = await authenticate.admin(request);
  return business.updateShopSettings(session.shop, settings);
}

export async function canReinitialize(request: Request): Promise<{ allowed: boolean; remainingMs: number }> {
  const { session } = await authenticate.admin(request);
  return business.canReinitialize(session.shop);
}

export async function updateLastReinitializeAt(request: Request): Promise<Settings> {
  const { session } = await authenticate.admin(request);
  return business.updateLastReinitializeAt(session.shop);
}
