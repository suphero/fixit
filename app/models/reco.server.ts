import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import type { RecommendationType } from "@prisma/client";
import { RecommendationStatus, TargetType } from "@prisma/client";
import db from "../db.server";
import { getProductUrlFromGid, getProductVariantUrlFromGid } from "../utils/url.server";
import { authenticate } from "../shopify.server";

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

// Add function to get settings
export async function getShopSettings(request: Request) {
  const { session } = await authenticate.admin(request);
  const settings = await db.settings.findFirst({
    where: { shopId: session.shop },
  });

  // Return default settings if none exist
  return settings ?? {
    shortTitleLength: 10,
    longTitleLength: 100,
    shortDescriptionLength: 50,
    longDescriptionLength: 500,
    minRevenueRate: 0.2,
    maxRevenueRate: 0.8,
    lowDiscountRate: 0.1,
    highDiscountRate: 0.5,
  };
}

// Update the criteria to use settings
const createProductRecommendationCriteria = (settings: any) => ({
  NO_IMAGE: {
    filter: (node: ProductNode) => node.featuredMedia === null,
  },
  SHORT_TITLE: {
    filter: (node: ProductNode) => node.title.length < settings.shortTitleLength,
  },
  LONG_TITLE: {
    filter: (node: ProductNode) => node.title.length > settings.longTitleLength,
  },
  SHORT_DESCRIPTION: {
    filter: (node: ProductNode) => node.description.length < settings.shortDescriptionLength,
  },
  LONG_DESCRIPTION: {
    filter: (node: ProductNode) => node.description.length > settings.longDescriptionLength,
  },
  NO_STOCK: {
    filter: (node: ProductNode) => node.totalInventory === 0,
  },
});

const createVariantRecommendationCriteria = (settings: any) => ({
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
      return price >= cost && price < (cost * (1 + settings.minRevenueRate));
    },
  },
  EXPENSIVE: {
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;
      return price > (cost * (1 + settings.maxRevenueRate));
    },
  },
  LOW_DISCOUNT: {
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (compareAtPrice === 0) return false;
      const discountPercentage = ((compareAtPrice - price) / compareAtPrice) * 100;
      return discountPercentage > 0 && discountPercentage < (settings.lowDiscountRate * 100);
    },
  },
  HIGH_DISCOUNT: {
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (compareAtPrice === 0) return false;
      const discountPercentage = ((compareAtPrice - price) / compareAtPrice) * 100;
      return discountPercentage > (settings.highDiscountRate * 100);
    },
  },
});

export async function initializeAllProducts(
  request: Request,
  graphql: AdminGraphqlClient,
) {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);
  const PRODUCT_RECOMMENDATION_CRITERIA = createProductRecommendationCriteria(settings);

  await db.recommendation.deleteMany({
    where: {
      shop: session.shop,
      targetType: TargetType.PRODUCT,
      status: RecommendationStatus.PENDING
    },
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
          shop: session.shop,
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
  request: Request,
  graphql: AdminGraphqlClient,
) {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);
  const PRODUCT_VARIANT_RECOMMENDATION_CRITERIA = createVariantRecommendationCriteria(settings);

  await db.recommendation.deleteMany({
    where: {
      shop: session.shop,
      targetType: TargetType.PRODUCT_VARIANT,
      status: RecommendationStatus.PENDING
    },
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
          shop: session.shop,
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
  request: Request,
  recommendationType: RecommendationType,
) {
  const { session } = await authenticate.admin(request);
  return prisma.recommendation.count({
    where: {
      shop: session.shop,
      recommendationType,
      status: RecommendationStatus.PENDING
    },
  });
}

export async function getRecommendationList(
  request: Request,
  recommendationType: RecommendationType,
  page: number,
  size: number,
) {
  const { session } = await authenticate.admin(request);
  const skip = (page - 1) * size;
  const take = size;

  return prisma.recommendation.findMany({
    where: {
      shop: session.shop,
      recommendationType,
      status: RecommendationStatus.PENDING
    },
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateProductTitle(
  request: Request,
  recommendationId: string,
  newTitle: string
) {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  // Get the recommendation
  const recommendation = await db.recommendation.findFirst({
    where: { id: recommendationId, shop: session.shop },
  });

  if (!recommendation) {
    throw new Error('Recommendation not found');
  }

  // Validate title length based on recommendation type
  if (newTitle.length < settings.shortTitleLength) {
    throw new Error(`Title must be at least ${settings.shortTitleLength} characters`);
  }
  if (newTitle.length > settings.longTitleLength) {
    throw new Error(`Title must not exceed ${settings.longTitleLength} characters`);
  }

  // Update product title in Shopify
  await admin.graphql(
    `mutation updateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          id: recommendation.targetId,
          title: newTitle,
        },
      },
    },
  );

  // Update recommendation status
  return db.recommendation.update({
    where: { id: recommendationId },
    data: {
      status: 'RESOLVED',
      targetTitle: newTitle,
    },
  });
}
