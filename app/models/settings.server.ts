import type { Settings } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const DEFAULT_SETTINGS = {
  shortTitleLength: 20,
  longTitleLength: 70,
  shortDescriptionLength: 80,
  longDescriptionLength: 400,
  minRevenueRate: 10,
  maxRevenueRate: 90,
  lowDiscountRate: 5,
  highDiscountRate: 70,
  understockDays: 7,
  overstockDays: 60,
  passiveDays: 180,
} as const;

export async function getShopSettings(request: Request): Promise<Settings> {
  const { session } = await authenticate.admin(request);
  const settings = await db.settings.findFirst({
    where: { shop: session.shop },
  });

  return settings ?? {
    id: "",
    shop: session.shop,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...DEFAULT_SETTINGS,
  };
}

export async function updateShopSettings(
  request: Request,
  data: Partial<Settings>
): Promise<Settings> {
  const { session } = await authenticate.admin(request);

  return db.settings.upsert({
    where: { shop: session.shop },
    update: data,
    create: {
      shop: session.shop,
      ...DEFAULT_SETTINGS,
      ...data,
    },
  });
}
