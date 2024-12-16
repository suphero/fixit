import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import type { RecommendationType } from "@prisma/client";
import { TargetType } from "@prisma/client";
import db from "../db.server";
import { getProductUrlFromGid, getProductVariantUrlFromGid } from "../utils/url.server";

// NO_IMAGE -> ARCHIVE / UPLOAD_IMAGE
// SHORT_TITLE -> UPDATE_TITLE
// LONG_TITLE -> UPDATE_TITLE
// SHORT_DESCRIPTION -> UPDATE_DESCRIPTION
// LONG_DESCRIPTION -> UPDATE_DESCRIPTION
// NO_STOCK -> ARCHIVE
// NO_COST -> DEFINE_COST

// Add type for variant node
type ProductVariantNode = {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryItem: {
    unitCost: { amount: string; } | null;
  };
  product: {
    id: string;
    title: string;
    hasOnlyDefaultVariant: boolean;
  };
};

// Add type for product node
type ProductNode = {
  id: string;
  title: string;
  description: string;
  totalInventory: number;
  featuredMedia: { id: string } | null;
};

const PRODUCT_RECOMMENDATION_CRITERIA = {
  NO_IMAGE: {
    filter: (node: ProductNode) => node.featuredMedia === null,
  },
  SHORT_TITLE: {
    filter: (node: any) => node.title.length < 10,
  },
  LONG_TITLE: {
    filter: (node: any) => node.title.length > 50,
  },
  SHORT_DESCRIPTION: {
    filter: (node: any) => node.description.length < 100,
  },
  LONG_DESCRIPTION: {
    filter: (node: any) => node.description.length > 1000,
  },
  NO_STOCK: {
    filter: (node: any) => node.totalInventory === 0,
  },
};

const PRODUCT_VARIANT_RECOMMENDATION_CRITERIA = {
  NO_COST: {
    filter: (node: ProductVariantNode) => node.inventoryItem?.unitCost === null,
  },
  SALE_AT_LOSS: {
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;

      return price < cost;
    },
  },
  CHEAP: {
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;

      // Price should be above cost but below 20% profit margin
      return price >= cost && price < (cost * 1.2);
    },
  },
  EXPENSIVE: {
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;

      const maximumPrice = cost * 1.8; // 80% profit margin
      return price > maximumPrice;
    },
  },
  LOW_DISCOUNT: {
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (compareAtPrice === 0) return false;

      const discountPercentage = ((compareAtPrice - price) / compareAtPrice) * 100;
      return discountPercentage > 0 && discountPercentage < 10;
    },
  },
  HIGH_DISCOUNT: {
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (compareAtPrice === 0) return false;

      const discountPercentage = ((compareAtPrice - price) / compareAtPrice) * 100;
      return discountPercentage > 90;
    },
  },
};

export async function initializeAllProducts(
  shop: string,
  graphql: AdminGraphqlClient,
) {
  await db.recommendation.deleteMany({
    where: { shop, targetType: TargetType.PRODUCT },
  });

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response: any = await graphql(
      `
        query getProducts($cursor: String) {
          products(first: 50, after: $cursor, query: "status:active") {
            edges {
              node {
                id
                title
                description
                totalInventory
                featuredMedia {
                  id
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `,
      { variables: { cursor } },
    );

    const {
      data: {
        products: { edges, pageInfo },
      },
    } = await response.json();

    const recommendations = edges.flatMap(({ node }: any) =>
      Object.entries(PRODUCT_RECOMMENDATION_CRITERIA)
        .filter(([, config]) => config.filter(node))
        .map(([type]) => ({
          shop,
          targetType: TargetType.PRODUCT,
          targetId: node.id,
          targetTitle: node.title,
          targetUrl: getProductUrlFromGid(node.id),
          recommendationType: type as RecommendationType,
          status: "PENDING",
        })),
    );

    if (recommendations.length > 0) {
      await db.recommendation.createMany({ data: recommendations });
    }

    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = edges[edges.length - 1].cursor;
    }
  }
}

export async function initializeAllProductVariants(
  shop: string,
  graphql: AdminGraphqlClient,
) {
  await db.recommendation.deleteMany({
    where: { shop, targetType: TargetType.PRODUCT_VARIANT },
  });

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response: any = await graphql(
      `
        query getProductVariants($cursor: String) {
          productVariants(first: 50, after: $cursor, query: "status:active") {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
                product {
                  id
                  title
                  hasOnlyDefaultVariant
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      `,
      { variables: { cursor } },
    );

    const {
      data: {
        productVariants: { edges, pageInfo },
      },
    } = await response.json();

    const recommendations = edges.flatMap(({ node }: any) =>
      Object.entries(PRODUCT_VARIANT_RECOMMENDATION_CRITERIA)
        .filter(([, config]) => config.filter(node))
        .map(([type]) => ({
          shop,
          targetType: TargetType.PRODUCT_VARIANT,
          targetId: node.id,
          targetTitle: node.product.hasOnlyDefaultVariant
            ? node.product.title
            : `${node.product.title} - ${node.title}`,
          targetUrl: getProductVariantUrlFromGid(node.product.id, node.id),
          recommendationType: type as RecommendationType,
          status: "PENDING",
        })),
    );

    if (recommendations.length > 0) {
      await db.recommendation.createMany({ data: recommendations });
    }

    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = edges[edges.length - 1].cursor;
    }
  }
}

export async function getRecommendationCount(
  shop: string,
  recommendationType: RecommendationType,
) {
  return prisma.recommendation.count({
    where: { shop, recommendationType },
  });
}

export async function getRecommendationList(
  shop: string,
  recommendationType: RecommendationType,
  page: number,
  size: number,
) {
  const skip = (page - 1) * size;
  const take = size;

  return prisma.recommendation.findMany({
    where: { shop, recommendationType },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
}
