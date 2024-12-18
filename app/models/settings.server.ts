import type { Settings } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const DEFAULT_SETTINGS = {
  shortTitleLength: 10,
  longTitleLength: 100,
  shortDescriptionLength: 50,
  longDescriptionLength: 500,
  minRevenueRate: 0.2,
  maxRevenueRate: 0.8,
  lowDiscountRate: 0.1,
  highDiscountRate: 0.5,
  understockDays: 3,
  overstockDays: 30,
  passiveDays: 90,
  noStockAction: "HIDE",
  passiveAction: "ARCHIVE",
} as const;

export async function getShopSettings(request: Request): Promise<Settings> {
  const { session } = await authenticate.admin(request);
  const settings = await db.settings.findFirst({
    where: { shop: session.shop },
  });

  // Return default settings if none exist
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
