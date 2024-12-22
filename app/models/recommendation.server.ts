import {
  RecommendationType,
  RecommendationStatus,
  TargetType,
} from "@prisma/client";
import type { Recommendation, RecommendationSubType, Settings, Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { getShopSettings } from "./settings.server";
import {
  getProductUrlFromGid,
  getProductVariantUrlFromGid,
} from "../utils/url.server";
import db from "../db.server";
import * as product from "./product.server";
import * as variant from "./variant.server";
import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";

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

const getPricingCriteria = (settings: Settings) => ({
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
      return price >= cost && price < cost * (1 + settings.minRevenueRate);
    },
  },
  EXPENSIVE: {
    filter: (node: ProductVariantNode) => {
      const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
      const price = Number(node.price ?? 0);
      if (cost === 0 || price === 0) return false;
      return price > cost * (1 + settings.maxRevenueRate);
    },
  },
  LOW_DISCOUNT: {
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

const getDefinitionCriteria = (settings: Settings) => ({
  NO_IMAGE: {
    filter: (node: ProductNode) => node.featuredMedia === null,
  },
  SHORT_TITLE: {
    filter: (node: ProductNode) =>
      node.title.length < settings.shortTitleLength,
  },
  LONG_TITLE: {
    filter: (node: ProductNode) => node.title.length > settings.longTitleLength,
  },
  SHORT_DESCRIPTION: {
    filter: (node: ProductNode) =>
      node.description.length < settings.shortDescriptionLength,
  },
  LONG_DESCRIPTION: {
    filter: (node: ProductNode) =>
      node.description.length > settings.longDescriptionLength,
  }
});

const getStockCriteria = (_settings: Settings) => ({
  NO_STOCK: {
    type: RecommendationType.STOCK,
    filter: (node: ProductNode) => node.totalInventory === 0,
  }
});

function findRecommendation(shop: string, id: string) {
  return db.recommendation.findFirst({
    where: { id, shop },
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

async function getProductRecommendations(
  shop: string,
  graphql: AdminGraphqlClient,
  settings: Settings,
) {
  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await product.fetch(graphql, cursor);

    for (const { node } of edges) {
      // Check definition issues
      const definitionIssues = Object.entries(getDefinitionCriteria(settings))
        .filter(([, criteria]) => criteria.filter(node))
        .map(([subType]) => subType as RecommendationSubType);

      if (definitionIssues.length > 0) {
        recommendations.push({
          shop,
          targetType: TargetType.PRODUCT,
          productId: node.id,
          variantId: null,
          targetTitle: node.title,
          targetUrl: getProductUrlFromGid(node.id),
          type: RecommendationType.DEFINITION,
          subTypes: definitionIssues,
          status: RecommendationStatus.PENDING,
        });
      }

      // Check stock issues
      const stockIssues = Object.entries(getStockCriteria(settings))
        .filter(([, criteria]) => criteria.filter(node))
        .map(([subType]) => subType as RecommendationSubType);

      if (stockIssues.length > 0) {
        recommendations.push({
          shop,
          targetType: TargetType.PRODUCT,
          productId: node.id,
          variantId: null,
          targetTitle: node.title,
          targetUrl: getProductUrlFromGid(node.id),
          type: RecommendationType.STOCK,
          subTypes: stockIssues,
          status: RecommendationStatus.PENDING,
        });
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

async function getProductVariantRecommendations(
  shop: string,
  graphql: AdminGraphqlClient,
  settings: Settings,
) {
  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await variant.fetch(graphql, cursor);

    for (const { node } of edges) {
      // Check pricing issues
      const pricingIssues = Object.entries(getPricingCriteria(settings))
        .filter(([, criteria]) => criteria.filter(node))
        .map(([subType]) => subType as RecommendationSubType);

      if (pricingIssues.length > 0) {
        const isVariantDefault = node.product.hasOnlyDefaultVariant;
        recommendations.push({
          shop,
          targetType: isVariantDefault
            ? TargetType.PRODUCT
            : TargetType.PRODUCT_VARIANT,
          productId: node.product.id,
          variantId: node.id,
          targetTitle: isVariantDefault
            ? node.product.title
            : `${node.product.title} - ${node.title}`,
          targetUrl: getProductVariantUrlFromGid(
            node.product.id,
            node.id,
            isVariantDefault,
          ),
          type: RecommendationType.PRICING,
          subTypes: pricingIssues,
          status: RecommendationStatus.PENDING,
        });
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

export async function getRecommendationsByType(
  request: Request,
  type: RecommendationType,
  status: RecommendationStatus,
  page: number,
  size: number,
) {
  const { session } = await authenticate.admin(request);
  const skip = (page - 1) * size;
  return db.recommendation.findMany({
    where: {
      shop: session.shop,
      type,
      status,
    },
    skip,
    take: size,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecommendationCounts(
  request: Request,
  status: RecommendationStatus,
): Promise<Record<RecommendationType, number>> {
  const { session } = await authenticate.admin(request);
  const recommendations = await db.recommendation.groupBy({
    by: ["type"],
    where: {
      shop: session.shop,
      status,
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

export async function initializeAll(request: Request) {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  const productReco = await getProductRecommendations(session.shop, admin.graphql, settings);
  const variantReco = await getProductVariantRecommendations(session.shop, admin.graphql, settings);
  recommendations.push(...productReco, ...variantReco);

  await db.recommendation.deleteMany({
    where: {
      shop: session.shop,
      status: RecommendationStatus.PENDING,
    },
  });
  if (recommendations.length > 0) {
    await db.recommendation.createMany({ data: recommendations });
  }
}

export async function updateTitle(
  request: Request,
  recommendationId: string,
  newTitle: string,
) {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await findRecommendation(session.shop, recommendationId);
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
  const { admin, session } = await authenticate.admin(request);

  const recommendation = await findRecommendation(
    session.shop,
    recommendationId,
  );
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
  const { admin, session } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await findRecommendation(
    session.shop,
    recommendationId,
  );
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
  cost?: string;
  price?: string;
  compareAtPrice?: string;
}

export async function updatePricing(
  request: Request,
  recommendationId: string,
  { cost, price, compareAtPrice }: PricingUpdate,
) {
  const { admin, session } = await authenticate.admin(request);
  const recommendation = await findRecommendation(
    session.shop,
    recommendationId,
  );
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
