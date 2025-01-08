import type { Shop, Subscription } from "@prisma/client";
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

export function updateSubscription(shop: string, subscription: Subscription) {
  return db.shop.update({
    where: { shop },
    data: { subscription },
  });
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
