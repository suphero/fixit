import type { Settings } from "@prisma/client";
import db from "../db.server";
import { updateRecommendationsForSettings } from "./recommendation.business.server";

const DEFAULT_SETTINGS: Omit<
  Settings,
  "id" | "shop" | "createdAt" | "updatedAt"
> = {
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
};

export async function getShopSettings(shop: string): Promise<Settings> {
  const settings = await db.settings.findUnique({
    where: { shop },
  });

  if (!settings) {
    return db.settings.create({
      data: {
        shop,
        ...DEFAULT_SETTINGS,
      },
    });
  }

  return settings;
}

export async function createSettings(shop: string): Promise<Settings> {
  await deleteSettings(shop);
  return db.settings.create({
    data: {
      shop,
      ...DEFAULT_SETTINGS,
    },
  });
}

export async function updateShopSettings(
  shop: string,
  updates: Partial<Settings>
): Promise<Settings> {
  const currentSettings = await getShopSettings(shop);
  const newSettings = await db.settings.update({
    where: { shop },
    data: updates,
  });

  // Check which specific settings have changed
  const changes = {
    pricing: isPricingChanged(currentSettings, newSettings),
    content: isContentChanged(currentSettings, newSettings),
    inventory: isInventoryChanged(currentSettings, newSettings),
  };

  // Update recommendations based on changed settings
  if (Object.values(changes).some(values => Object.values(values).some(Boolean))) {
    await updateRecommendationsForSettings(shop, changes);
  }

  return newSettings;
}

function isPricingChanged(old: Settings, new_: Settings) {
  return {
    minRevenueRate: old.minRevenueRate !== new_.minRevenueRate,
    maxRevenueRate: old.maxRevenueRate !== new_.maxRevenueRate,
    lowDiscountRate: old.lowDiscountRate !== new_.lowDiscountRate,
    highDiscountRate: old.highDiscountRate !== new_.highDiscountRate,
  };
}

function isContentChanged(old: Settings, new_: Settings) {
  return {
    shortTitle: old.shortTitleLength !== new_.shortTitleLength,
    longTitle: old.longTitleLength !== new_.longTitleLength,
    shortDescription: old.shortDescriptionLength !== new_.shortDescriptionLength,
    longDescription: old.longDescriptionLength !== new_.longDescriptionLength,
  };
}

function isInventoryChanged(old: Settings, new_: Settings) {
  return {
    understock: old.understockDays !== new_.understockDays,
    overstock: old.overstockDays !== new_.overstockDays,
    passive: old.passiveDays !== new_.passiveDays,
  };
}

export async function deleteSettings(shop: string) {
  return db.settings.deleteMany({
    where: { shop },
  });
}
