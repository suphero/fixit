import {
  RecommendationType,
  RecommendationStatus,
  TargetType,
} from "@prisma/client";
import type { Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { getShopSettings } from "./settings.server";
import {
  getProductUrlFromGid,
  getProductVariantUrlFromGid,
} from "../utils/url.server";
import db from "../db.server";
import * as product from "./product.server";
import * as variant from "./variant.server";

type ProductVariantNode = {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryItem: {
    unitCost: { amount: string } | null;
  };
  product: {
    id: string;
    title: string;
    hasOnlyDefaultVariant: boolean;
  };
};

type ProductNode = {
  id: string;
  title: string;
  description: string;
  totalInventory: number;
  featuredMedia: { id: string } | null;
};

const getProductRecommendationCriteria = (settings: any) => ({
  NO_IMAGE: {
    type: RecommendationType.DEFINITION,
    filter: (node: ProductNode) => node.featuredMedia === null,
  },
  SHORT_TITLE: {
    type: RecommendationType.DEFINITION,
    filter: (node: ProductNode) =>
      node.title.length < settings.shortTitleLength,
  },
  LONG_TITLE: {
    type: RecommendationType.DEFINITION,
    filter: (node: ProductNode) => node.title.length > settings.longTitleLength,
  },
  SHORT_DESCRIPTION: {
    type: RecommendationType.DEFINITION,
    filter: (node: ProductNode) =>
      node.description.length < settings.shortDescriptionLength,
  },
  LONG_DESCRIPTION: {
    type: RecommendationType.DEFINITION,
    filter: (node: ProductNode) =>
      node.description.length > settings.longDescriptionLength,
  },
  NO_STOCK: {
    type: RecommendationType.STOCK,
    filter: (node: ProductNode) => node.totalInventory === 0,
  },
});

const getVariantRecommendationCriteria = (settings: any) => ({
  NO_COST: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => node.inventoryItem?.unitCost === null,
  },
  SALE_AT_LOSS: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;
      return price < cost;
    },
  },
  CHEAP: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;
      return price >= cost && price < cost * (1 + settings.minRevenueRate);
    },
  },
  EXPENSIVE: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;
      return price > cost * (1 + settings.maxRevenueRate);
    },
  },
  LOW_DISCOUNT: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (!compareAtPrice) return false;

      const discountPercentage =
        ((compareAtPrice - price) / compareAtPrice) * 100;
      return (
        discountPercentage > 0 &&
        discountPercentage < settings.lowDiscountRate * 100
      );
    },
  },
  HIGH_DISCOUNT: {
    type: RecommendationType.PRICING,
    filter: (node: ProductVariantNode) => {
      const price = Number(node.price ?? 0);
      const compareAtPrice = Number(node.compareAtPrice ?? 0);
      if (!compareAtPrice) return false;

      const discountPercentage =
        ((compareAtPrice - price) / compareAtPrice) * 100;
      return discountPercentage > settings.highDiscountRate * 100;
    },
  },
});

async function findRecommendation(
  request: Request,
  recommendationId: string,
) {
  const { session } = await authenticate.admin(request);
  return db.recommendation.findFirst({
    where: { id: recommendationId, shop: session.shop },
  });
}

async function updateRecommendationStatus(
  recommendationId: string,
  status: RecommendationStatus,
  updates: Partial<Recommendation> = {},
) {
  return db.recommendation.update({
    where: { id: recommendationId },
    data: {
      status,
      ...updates,
    },
  });
}

async function createRecommendations(
  recommendations: Omit<Recommendation, "id" | "createdAt" | "updatedAt">[],
) {
  return db.recommendation.createMany({
    data: recommendations,
  });
}

async function deleteRecommendations(
  shop: string,
  status: RecommendationStatus,
  targetType: TargetType
) {
  return db.recommendation.deleteMany({
    where: {
      shop,
      status,
      targetType
    },
  });
}

async function getIgnoredRecommendations(
  shop: string,
  targetType: TargetType,
) {
  return db.recommendation.findMany({
    where: {
      shop,
      targetType,
      status: "IGNORED",
    },
    select: {
      productId: true,
      type: true,
    },
  });
}

async function initializeAllProducts(
  request: Request
) {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);
  const criteria = getProductRecommendationCriteria(settings);

  const ignoredRecommendations = await getIgnoredRecommendations(
    session.shop,
    TargetType.PRODUCT,
  );
  const ignoredSet = new Set(
    ignoredRecommendations.map((rec) => `${rec.productId}-${rec.type}`),
  );

  await deleteRecommendations(
    session.shop,
    RecommendationStatus.PENDING,
    TargetType.PRODUCT,
  );

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await product.fetch(admin.graphql, cursor);

    const recommendations = edges.flatMap(({ node }: { node: ProductNode }) =>
      Object.entries(criteria)
        .filter(([, config]) => config.filter(node))
        .filter(([subType]) => !ignoredSet.has(`${node.id}-${subType}`))
        .map(([subType, config]) => ({
          shop: session.shop,
          targetType: TargetType.PRODUCT,
          productId: node.id,
          targetTitle: node.title,
          targetUrl: getProductUrlFromGid(node.id),
          type: config.type,
          subType,
          status: RecommendationStatus.PENDING,
        })),
    );

    if (recommendations.length > 0) {
      await createRecommendations(recommendations);
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }
}

async function initializeAllProductVariants(
  request: Request
) {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);
  const criteria = getVariantRecommendationCriteria(settings);

  await deleteRecommendations(
    session.shop,
    RecommendationStatus.PENDING,
    TargetType.PRODUCT_VARIANT,
  );

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await variant.fetch(admin.graphql, cursor);

    const recommendations = edges.flatMap(
      ({ node }: { node: ProductVariantNode }) =>
        Object.entries(criteria)
          .filter(([, config]) => config.filter(node))
          .map(([subType, config]) => ({
            shop: session.shop,
            targetType: TargetType.PRODUCT_VARIANT,
            productId: node.product.id,
            variantId: node.id,
            targetTitle: node.product.hasOnlyDefaultVariant
              ? node.product.title
              : `${node.product.title} - ${node.title}`,
            targetUrl: getProductVariantUrlFromGid(
              node.product.id,
              node.id,
              node.product.hasOnlyDefaultVariant,
            ),
            type: config.type,
            subType,
            status: RecommendationStatus.PENDING,
          })),
    );

    if (recommendations.length > 0) {
      await createRecommendations(recommendations);
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }
}

export async function getRecommendationsByType(
  request: Request,
  type: RecommendationType,
  status: RecommendationStatus | RecommendationStatus[],
  page: number,
  size: number,
) {
  const { session } = await authenticate.admin(request);
  const skip = (page - 1) * size;
  return db.recommendation.findMany({
    where: {
      shop: session.shop,
      type,
      status: Array.isArray(status) ? { in: status } : status,
    },
    skip,
    take: size,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecommendationCounts(
  request: Request,
  status: RecommendationStatus | RecommendationStatus[],
): Promise<Record<RecommendationType, number>> {
  const { session } = await authenticate.admin(request);
  const recommendations = await db.recommendation.groupBy({
    by: ["type"],
    where: {
      shop: session.shop,
      status: Array.isArray(status) ? { in: status } : status,
    },
    _count: true,
  });

  return recommendations.reduce(
    (acc, { type, _count }) => ({
      ...acc,
      [type]: _count,
    }),
    {} as Record<RecommendationType, number>,
  );
}

export async function skipRecommendation(
  request: Request,
  recommendationId: string,
) {
  const recommendation = await findRecommendation(request, recommendationId);

  if (!recommendation) {
    throw new Error("Recommendation not found");
  }

  return updateRecommendationStatus(
    recommendationId,
    RecommendationStatus.IGNORED,
  );
}

export async function unskipRecommendation(
  request: Request,
  recommendationId: string,
) {
  const recommendation = await findRecommendation(request, recommendationId);

  if (!recommendation) {
    throw new Error("Recommendation not found");
  }

  return updateRecommendationStatus(
    recommendationId,
    RecommendationStatus.PENDING,
  );
}

export async function initializeAll(request: Request) {
  await initializeAllProducts(request);
  await initializeAllProductVariants(request);
}

export async function updateTitle(
  request: Request,
  recommendationId: string,
  newTitle: string,
) {
  const { admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await findRecommendation(request, recommendationId);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) {
    throw new Error("Product not found");
  }

  if (newTitle.length < settings.shortTitleLength) {
    throw new Error(
      `Title must be at least ${settings.shortTitleLength} characters`,
    );
  }
  if (newTitle.length > settings.longTitleLength) {
    throw new Error(
      `Title must not exceed ${settings.longTitleLength} characters`,
    );
  }

  await product.updateTitle(admin.graphql, recommendation.productId, newTitle);

  return updateRecommendationStatus(recommendationId, "RESOLVED", {
    targetTitle: newTitle,
  });
}

export async function archiveOrDelete(
  request: Request,
  recommendationId: string,
) {
  const { admin } = await authenticate.admin(request);

  const recommendation = await findRecommendation(request, recommendationId);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) {
    throw new Error("Product not found");
  }

  if (recommendation.targetType === TargetType.PRODUCT) {
    await product.archive(admin.graphql, recommendation.productId);
  } else if (recommendation.targetType === TargetType.PRODUCT_VARIANT) {
    if (!recommendation.variantId) {
      throw new Error("Variant not found");
    }
    const isDefault = await variant.isVariantDefault(
      admin.graphql,
      recommendation.variantId,
    );
    if (isDefault) {
      await product.archive(admin.graphql, recommendation.productId);
    } else {
      await variant.deleteVariant(
        admin.graphql,
        recommendation.productId,
        recommendation.variantId,
      );
    }
  } else {
    throw new Error("Invalid recommendation type");
  }

  return updateRecommendationStatus(recommendationId, "RESOLVED");
}

export async function updateDescription(
  request: Request,
  recommendationId: string,
  newDescription: string,
) {
  const { admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await findRecommendation(request, recommendationId);
  if (!recommendation) throw new Error("Recommendation not found");

  if (!recommendation.productId) {
    throw new Error("Product not found");
  }

  // Validate description length
  if (newDescription.length < settings.shortDescriptionLength) {
    throw new Error(
      `Description must be at least ${settings.shortDescriptionLength} characters`,
    );
  }
  if (newDescription.length > settings.longDescriptionLength) {
    throw new Error(
      `Description must not exceed ${settings.longDescriptionLength} characters`,
    );
  }

  await product.updateDescription(admin.graphql, recommendation.productId, newDescription);

  return updateRecommendationStatus(recommendationId, "RESOLVED");
}

interface PricingUpdate {
  cost: number;
  price: number;
  compareAtPrice?: number;
}

export async function updatePricing(
  request: Request,
  recommendationId: string,
  { cost, price, compareAtPrice }: PricingUpdate,
) {
  const { admin } = await authenticate.admin(request);
  const recommendation = await findRecommendation(request, recommendationId);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) {
    throw new Error("Product not found");
  }
  if (!recommendation.variantId) {
    throw new Error("Variant not found");
  }

  await variant.updatePricing(
    admin.graphql,
    recommendation.productId,
    recommendation.variantId,
    price,
    cost,
    compareAtPrice,
  );

  return updateRecommendationStatus(recommendationId, "RESOLVED");
}
