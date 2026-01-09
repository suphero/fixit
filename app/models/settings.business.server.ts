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
  passiveDays: 30,
  lastReinitializeAt: null,
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
    text: isTextChanged(currentSettings, newSettings),
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

function isTextChanged(old: Settings, new_: Settings) {
  return {
    shortTitle: old.shortTitleLength !== new_.shortTitleLength,
    longTitle: old.longTitleLength !== new_.longTitleLength,
    shortDescription: old.shortDescriptionLength !== new_.shortDescriptionLength,
    longDescription: old.longDescriptionLength !== new_.longDescriptionLength,
  };
}

function isInventoryChanged(old: Settings, new_: Settings) {
  const isUnderstockChanged = old.understockDays !== new_.understockDays;
  const isOverstockChanged = old.overstockDays !== new_.overstockDays;
  const isPassiveChanged = old.passiveDays !== new_.passiveDays;
  return {
    understock: isUnderstockChanged || isPassiveChanged,
    overstock: isOverstockChanged || isPassiveChanged,
    passive: isUnderstockChanged || isOverstockChanged || isPassiveChanged,
  };
}

export async function deleteSettings(shop: string) {
  return db.settings.deleteMany({
    where: { shop },
  });
}

const REINITIALIZE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

export async function canReinitialize(shop: string): Promise<{ allowed: boolean; remainingMs: number }> {
  const settings = await getShopSettings(shop);

  if (!settings.lastReinitializeAt) {
    return { allowed: true, remainingMs: 0 };
  }

  const now = Date.now();
  const lastReinitialize = settings.lastReinitializeAt.getTime();
  const timeSinceLastReinitialize = now - lastReinitialize;

  if (timeSinceLastReinitialize >= REINITIALIZE_COOLDOWN_MS) {
    return { allowed: true, remainingMs: 0 };
  }

  const remainingMs = REINITIALIZE_COOLDOWN_MS - timeSinceLastReinitialize;
  return { allowed: false, remainingMs };
}

export async function updateLastReinitializeAt(shop: string): Promise<Settings> {
  return db.settings.update({
    where: { shop },
    data: { lastReinitializeAt: new Date() },
  });
}
