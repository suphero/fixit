import type { Shop } from "@prisma/client";
import { Subscription } from "@prisma/client";
import db from "../db.server";

export async function deleteShop(shop: string) {
  return db.shop.deleteMany({
    where: { shop },
  });
}

export async function createShop(shop: string): Promise<Shop> {
  await deleteShop(shop);
  return db.shop.create({
    data: {
      shop,
    },
  });
}

export async function updateSubscription(shop: string, subscriptionId: string, subscriptionName: Subscription, subscriptionStatus: string) {
  const shopData = await getShop(shop);
  if (subscriptionStatus === "ACTIVE") {
    return db.shop.update({
      where: { shop },
      data: {
        subscriptionId,
        subscriptionName,
      },
    });
  }
  // Not active, so we need to remove the subscription
  if (shopData.subscriptionId === subscriptionId && subscriptionStatus !== "ACTIVE") {
    return db.shop.update({
      where: { shop },
      data: {
        subscriptionId: null,
        subscriptionName: Subscription.Free,
      },
    });
  }
  console.error(`Unexpected updateSubscription call for shop: ${shop}, subscriptionId: ${subscriptionId}, subscriptionStatus: ${subscriptionStatus}`);
}

export async function getShop(shop: string): Promise<Shop> {
  const response = await db.shop.findUnique({
    where: { shop },
  });

  if (!response) {
    return createShop(shop);
  }

  return response;
}

export async function completeOnboarding(shop: string): Promise<Shop> {
  return db.shop.update({
    where: { shop },
    data: {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });
}
