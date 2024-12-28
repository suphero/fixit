import type { Settings } from "@prisma/client";
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

export async function getShopSettings(shop: string): Promise<Settings> {
  const settings = await db.settings.findFirst({
    where: { shop },
  });

  return (
    settings ?? {
      id: "",
      shop,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...DEFAULT_SETTINGS,
    }
  );
}

export async function updateShopSettings(
  shop: string,
  data: Partial<Settings>,
): Promise<Settings> {
  return db.settings.upsert({
    where: { shop },
    update: data,
    create: {
      shop,
      ...DEFAULT_SETTINGS,
      ...data,
    },
  });
}

export function deleteSettings(shop: string) {
  return db.settings.deleteMany({ where: { shop } });
}
