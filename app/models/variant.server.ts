import { authenticate } from "../shopify.server";
import { getShopSettings } from "./settings.server";
import db from "../db.server";

export async function updatePrice(
  request: Request,
  recommendationId: string,
  newPrice: number
) {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await db.recommendation.findFirst({
    where: { id: recommendationId, shop: session.shop },
  });

  if (!recommendation) {
    throw new Error('Recommendation not found');
  }

  if (!recommendation.variantId) {
    throw new Error('Variant not found');
  }

  // Get current variant details
  const details = await getDetails(request, recommendation.variantId);
  const minPrice = details.cost * (1 + settings.minRevenueRate);
  const maxPrice = details.cost * (1 + settings.maxRevenueRate);

  // Validate price against revenue range
  if (newPrice < minPrice) {
    throw new Error(`Price cannot be lower than $${minPrice.toFixed(2)} (${settings.minRevenueRate * 100}% revenue)`);
  }
  if (newPrice > maxPrice) {
    throw new Error(`Price cannot be higher than $${maxPrice.toFixed(2)} (${settings.maxRevenueRate * 100}% revenue)`);
  }

  await admin.graphql(
    `mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        productId: recommendation.productId,
        variants: [
          {
            id: recommendation.variantId,
            price: String(newPrice),
          },
        ],
      },
    },
  );

  return db.recommendation.update({
    where: { id: recommendationId },
    data: {
      status: 'RESOLVED',
    },
  });
}

export async function getDetails(
  request: Request,
  variantId: string
) {
  const { admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const response = await admin.graphql(
    `query getVariant($id: ID!) {
      productVariant(id: $id) {
        price
        inventoryItem {
          unitCost {
            amount
          }
        }
      }
    }`,
    {
      variables: { id: variantId },
    },
  );

  const { data } = await response.json();
  const cost = Number(data.productVariant.inventoryItem?.unitCost?.amount ?? 0);
  const currentPrice = Number(data.productVariant.price);

  const minPrice = cost * (1 + settings.minRevenueRate);
  const maxPrice = cost * (1 + settings.maxRevenueRate);

  return {
    cost,
    currentPrice,
    minPrice,
    maxPrice,
  };
}
