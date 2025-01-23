import type { Recommendation, Settings, Prisma } from "@prisma/client";
import {
  RecommendationType,
  RecommendationStatus,
  TargetType,
  RecommendationSubType,
} from "@prisma/client";
import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import {
  getProductUrlFromGid,
  getProductVariantUrlFromGid,
} from "../utils/url.server";
import db from "../db.server";
import * as productBusiness from "./product.business.server";
import * as variantBusiness from "./variant.business.server";
import * as settingsBusiness from "./settings.business.server";
import * as shopBusiness from "./shop.business.server";
import { publish } from "../consumers/generate-reco.server";

type ProductVariantNode = {
  id: string;
  title: string;
  price: string;
  compareAtPrice: string | null;
  inventoryQuantity: number;
  inventoryItem: {
    tracked: boolean;
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

type ProductVariantMetricNode = {
  id: string;
  inventoryQuantity: number;
  inventoryItem: {
    tracked: boolean;
  };
  averageDailySales: number;
  variantCreatedAt: Date;
  lastOrderDate: Date | null;
};

export type RecommendationCount = {
  free: number;
  premium: number;
  all: number;
}

function getCriterias(
  settings: Settings,
  filter: {
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
    targetTypes?: TargetType[];
  },
) {
  let criterias = [
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.NO_COST,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) =>
        node.inventoryItem?.unitCost === null,
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.FREE,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const price = Number(node.price ?? 0);
        return price === 0;
      },
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.SALE_AT_LOSS,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
        const price = Number(node.price ?? 0);
        if (cost === 0 || price === 0) return false;
        return price < cost;
      },
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.CHEAP,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
        const price = Number(node.price ?? 0);
        if (cost === 0 || price === 0) return false;
        return price >= cost && price < cost * (1 + settings.minRevenueRate);
      },
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.EXPENSIVE,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const cost = Number(node.inventoryItem?.unitCost?.amount ?? 0);
        const price = Number(node.price ?? 0);
        if (cost === 0 || price === 0) return false;
        return price > cost * (1 + settings.maxRevenueRate);
      },
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.NO_DISCOUNT,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const price = Number(node.price ?? 0);
        const compareAtPrice = Number(node.compareAtPrice ?? 0);
        if (!compareAtPrice) return false;
        return compareAtPrice <= price;
      },
    },
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.LOW_DISCOUNT,
      targetType: TargetType.PRODUCT_VARIANT,
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
    {
      type: RecommendationType.PRICING,
      subType: RecommendationSubType.HIGH_DISCOUNT,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) => {
        const price = Number(node.price ?? 0);
        const compareAtPrice = Number(node.compareAtPrice ?? 0);
        if (!compareAtPrice) return false;

        const discountPercentage =
          ((compareAtPrice - price) / compareAtPrice) * 100;
        return discountPercentage > settings.highDiscountRate * 100;
      },
    },
    {
      type: RecommendationType.TEXT,
      subType: RecommendationSubType.SHORT_TITLE,
      targetType: TargetType.PRODUCT,
      filter: (node: ProductNode) =>
        node.title.length < settings.shortTitleLength,
    },
    {
      type: RecommendationType.TEXT,
      subType: RecommendationSubType.LONG_TITLE,
      targetType: TargetType.PRODUCT,
      filter: (node: ProductNode) =>
        node.title.length > settings.longTitleLength,
    },
    {
      type: RecommendationType.TEXT,
      subType: RecommendationSubType.SHORT_DESCRIPTION,
      targetType: TargetType.PRODUCT,
      filter: (node: ProductNode) =>
        node.description.length < settings.shortDescriptionLength,
    },
    {
      type: RecommendationType.TEXT,
      subType: RecommendationSubType.LONG_DESCRIPTION,
      targetType: TargetType.PRODUCT,
      filter: (node: ProductNode) =>
        node.description.length > settings.longDescriptionLength,
    },
    {
      type: RecommendationType.MEDIA,
      subType: RecommendationSubType.NO_IMAGE,
      targetType: TargetType.PRODUCT,
      filter: (node: ProductNode) => node.featuredMedia === null,
    },
    {
      type: RecommendationType.STOCK,
      subType: RecommendationSubType.NO_STOCK,
      targetType: TargetType.PRODUCT_VARIANT,
      filter: (node: ProductVariantNode) =>
        node.inventoryQuantity === 0 && node.inventoryItem.tracked,
    },
  ];

  if (filter.types) {
    criterias = criterias.filter(
      (criteria) => filter.types?.includes(criteria.type) ?? false,
    );
  }

  if (filter.subTypes) {
    criterias = criterias.filter(
      (criteria) => filter.subTypes?.includes(criteria.subType) ?? false,
    );
  }

  if (filter.targetTypes) {
    criterias = criterias.filter(
      (criteria) => filter.targetTypes?.includes(criteria.targetType) ?? false,
    );
  }

  return criterias;
}

function isPassive(node: ProductVariantMetricNode, settings: Settings) {
  if (!node.inventoryQuantity || node.inventoryQuantity <= 0) {
    return false;
  }

  const now = new Date();
  // Use lastOrderDate if exists, otherwise use variantCreatedAt
  const lastActivity = node.lastOrderDate || node.variantCreatedAt;
  return lastActivity.getTime() < now.getTime() - settings.passiveDays * 24 * 60 * 60 * 1000;
}

function hasValidInventoryRange(
  averageDailySales: number,
  understockDays: number,
  overstockDays: number,
) {
  const minStock = averageDailySales * understockDays;
  const maxStock = averageDailySales * overstockDays;
  return maxStock - minStock > 1;
}

function getPremiumCriterias(
  settings: Settings,
  filter: {
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
    targetTypes?: TargetType[];
  },
) {
  let criterias = [
    {
      type: RecommendationType.STOCK,
      subType: RecommendationSubType.UNDERSTOCK,
      targetType: TargetType.PRODUCT_VARIANT,
      filter(node: ProductVariantMetricNode) {
        const passive = isPassive(node, settings);
        const validInventoryRange = hasValidInventoryRange(node.averageDailySales, settings.understockDays, settings.overstockDays);
        return (
          !passive &&
          validInventoryRange &&
          node.inventoryItem.tracked &&
          node.averageDailySales > 0 &&
          node.inventoryQuantity < node.averageDailySales * settings.understockDays
        );
      },
    },
    {
      type: RecommendationType.STOCK,
      subType: RecommendationSubType.OVERSTOCK,
      targetType: TargetType.PRODUCT_VARIANT,
      filter(node: ProductVariantMetricNode) {
        const passive = isPassive(node, settings);
        const validInventoryRange = hasValidInventoryRange(node.averageDailySales, settings.understockDays, settings.overstockDays);
        return (
          !passive &&
          validInventoryRange &&
          node.inventoryItem.tracked &&
          node.averageDailySales > 0 &&
          node.inventoryQuantity > node.averageDailySales * settings.overstockDays
        );
      },
    },
    {
      type: RecommendationType.STOCK,
      subType: RecommendationSubType.PASSIVE,
      targetType: TargetType.PRODUCT_VARIANT,
      filter(node: ProductVariantMetricNode) {
        return isPassive(node, settings);
      },
    },
  ];

  if (filter.types) {
    criterias = criterias.filter(
      (criteria) => filter.types?.includes(criteria.type) ?? false,
    );
  }

  if (filter.subTypes) {
    criterias = criterias.filter(
      (criteria) => filter.subTypes?.includes(criteria.subType) ?? false,
    );
  }

  if (filter.targetTypes) {
    criterias = criterias.filter(
      (criteria) => filter.targetTypes?.includes(criteria.targetType) ?? false,
    );
  }

  return criterias;
}

function findRecommendation(shop: string, id: string) {
  return db.recommendation.findFirst({
    where: { id, shop },
  });
}

async function updateRecommendationStatus(
  id: string,
  status: RecommendationStatus,
  updates: Partial<Recommendation> = {},
) {
  return db.recommendation.update({
    where: { id },
    data: {
      status,
      ...updates,
    },
  });
}

interface RecommendationGroup {
  type: RecommendationType;
  subTypes: RecommendationSubType[];
}

// Add this helper function
function groupRecommendations(criterias: Array<{
  type: RecommendationType;
  subType: RecommendationSubType;
}>) {
  return criterias.reduce((acc, criteria) => {
    const key = criteria.type;
    if (!acc[key]) {
      acc[key] = {
        type: criteria.type,
        subTypes: [],
      };
    }
    acc[key].subTypes.push(criteria.subType);
    return acc;
  }, {} as Record<string, RecommendationGroup>);
}

async function getProductRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  settings: Settings,
  params: {
    productId?: string;
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
  } = {},
) {
  // Get all product-level criteria
  const criterias = getCriterias(settings, {
    types: params?.types,
    subTypes: params?.subTypes,
    targetTypes: [TargetType.PRODUCT],
  });

  if (criterias.length === 0) return [];

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await productBusiness.fetchProduct(graphql, {
      cursor,
      productId: params?.productId,
    });

    for (const { node } of edges) {
      const matchingCriterias = criterias.filter((criteria) =>
        criteria.filter(node),
      );

      if (matchingCriterias.length > 0) {
        const recommendationGroups = groupRecommendations(matchingCriterias);

        // Create recommendations for each group
        Object.values(recommendationGroups).forEach(({ type, subTypes }) => {
          recommendations.push({
            shop,
            targetType: TargetType.PRODUCT,
            productId: node.id,
            variantId: null,
            targetTitle: node.title,
            targetUrl: getProductUrlFromGid(node.id),
            type,
            subTypes,
            premium: false,
            status: RecommendationStatus.PENDING,
          });
        });
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

async function getProductVariantRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  settings: Settings,
  params: {
    productId?: string;
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
  } = {},
) {
  // Get all variant-level criteria
  const criterias = getCriterias(settings, {
    types: params?.types,
    subTypes: params?.subTypes,
    targetTypes: [TargetType.PRODUCT_VARIANT],
  });

  if (criterias.length === 0) return [];

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await variantBusiness.fetchVariant(graphql, {
      cursor,
      productId: params?.productId,
    });

    for (const { node } of edges) {
      const isVariantDefault = node.product.hasOnlyDefaultVariant;
      const matchingCriterias = criterias.filter((criteria) =>
        criteria.filter(node),
      );

      if (matchingCriterias.length > 0) {
        const recommendationGroups = groupRecommendations(matchingCriterias);

        // Create recommendations for each group
        Object.values(recommendationGroups).forEach(
          ({ type, subTypes }) => {
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
              type,
              subTypes,
              premium: false,
              status: RecommendationStatus.PENDING,
            });
          },
        );
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

async function getPremiumRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  settings: Settings,
  params: {
    productId?: string;
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
  } = {},
) {
  const criterias = getPremiumCriterias(settings, {
    types: params?.types,
    subTypes: params?.subTypes,
  });

  if (criterias.length === 0) return [];

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await variantBusiness.fetchVariant(graphql, {
      cursor,
      productId: params?.productId,
    });

    for (const { node } of edges) {
      const variantId = node.id;
      const variantMetric = await variantBusiness.getVariantMetrics(
        shop,
        variantId,
      );
      if (!variantMetric) continue;
      const metricNode: ProductVariantMetricNode = {
        id: variantId,
        inventoryQuantity: node.inventoryQuantity,
        inventoryItem: node.inventoryItem,
        averageDailySales: variantMetric.averageDailySales,
        variantCreatedAt: variantMetric.variantCreatedAt,
        lastOrderDate: variantMetric.lastOrderDate,
      };

      const isVariantDefault = node.product.hasOnlyDefaultVariant;
      const matchingCriterias = criterias.filter((criteria) =>
        criteria.filter(metricNode),
      );

      if (matchingCriterias.length > 0) {
        const recommendationGroups = groupRecommendations(matchingCriterias);

        // Create recommendations for each group
        Object.values(recommendationGroups).forEach(
          ({ type, subTypes }) => {
            recommendations.push({
              shop,
              targetType: isVariantDefault
                ? TargetType.PRODUCT
                : TargetType.PRODUCT_VARIANT,
              productId: node.product.id,
              variantId,
              targetTitle: isVariantDefault
                ? node.product.title
                : `${node.product.title} - ${node.title}`,
              targetUrl: getProductVariantUrlFromGid(
                node.product.id,
                node.id,
                isVariantDefault,
              ),
              type,
              subTypes,
              premium: true,
              status: RecommendationStatus.PENDING,
            });
          },
        );
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

export async function getRecommendationsByType(
  shop: string,
  type: RecommendationType,
  status: RecommendationStatus,
  page: number,
  size: number,
) {
  const shopDetails = await shopBusiness.getShop(shop);
  const isFree = shopDetails?.subscriptionName !== "Premium";
  const skip = (page - 1) * size;
  return db.recommendation.findMany({
    where: {
      shop,
      type,
      status,
      ...(isFree && { premium: false }),
    },
    skip,
    take: size,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecommendationCounts(
  shop: string,
  status: RecommendationStatus
): Promise<Record<RecommendationType, RecommendationCount>> {
  const counts = await db.recommendation.groupBy({
    by: ['type', 'premium'],
    where: {
      shop,
      status,
    },
    _count: true,
  });

  // Initialize result with default values
  const result: Record<RecommendationType, RecommendationCount> = {
    PRICING: { free: 0, premium: 0, all: 0 },
    TEXT: { free: 0, premium: 0, all: 0 },
    MEDIA: { free: 0, premium: 0, all: 0 },
    STOCK: { free: 0, premium: 0, all: 0 },
  };

  // Aggregate counts
  counts.forEach(count => {
    const type = count.type;
    const isPremium = count.premium;
    const countValue = count._count;

    if (isPremium) {
      result[type].premium += countValue;
    } else {
      result[type].free += countValue;
    }
    result[type].all += countValue;
  });

  return result;
}

export async function generateRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  params: {
    productId?: string;
    types?: RecommendationType[];
    subTypes?: RecommendationSubType[];
    premium?: boolean;
  },
) {
  console.info("Generating recommendations", { shop, params });
  const settings = await settingsBusiness.getShopSettings(shop);

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  if (params.premium !== true) {
    const productReco = await getProductRecommendations(
      graphql,
      shop,
      settings,
      params,
    );
    const variantReco = await getProductVariantRecommendations(
      graphql,
      shop,
      settings,
      params,
    );
    recommendations.push(...productReco, ...variantReco);
  }
  if (params.premium !== false) {
    const premiumReco = await getPremiumRecommendations(
      graphql,
      shop,
      settings,
      params,
    );
    recommendations.push(...premiumReco);
  }

  await db.recommendation.deleteMany({
    where: {
      shop,
      status: RecommendationStatus.PENDING,
      ...(params?.types && { type: { in: params?.types } }),
      ...(params?.subTypes && {
        subTypes: { hasSome: params?.subTypes },
      }),
      ...(params?.productId && { productId: params?.productId }),
      ...(params?.premium !== null && { premium: params.premium }),
    },
  });
  if (recommendations.length > 0) {
    await db.recommendation.createMany({ data: recommendations });
  }
}

export async function updatePricing(
  graphql: AdminGraphqlClient,
  shop: string,
  data: {
    id: string;
    cost?: string;
    price?: string;
    compareAtPrice?: string;
  },
) {
  const recommendation = await findRecommendation(shop, data.id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) {
    throw new Error("Product not found");
  }
  if (!recommendation.variantId) {
    throw new Error("Variant not found");
  }

  await variantBusiness.updatePricing(
    graphql,
    recommendation.productId,
    recommendation.variantId,
    data.price,
    data.cost,
    data.compareAtPrice,
  );

  return updateRecommendationStatus(data.id, "RESOLVED");
}

export async function updateText(
  graphql: AdminGraphqlClient,
  shop: string,
  data: {
    id: string;
    title: string;
    descriptionHtml: string;
  },
) {
  const settings = await settingsBusiness.getShopSettings(shop);
  const recommendation = await findRecommendation(shop, data.id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) throw new Error("Product not found");

  // Validate title
  if (data.title.length < settings.shortTitleLength) {
    throw new Error(
      `Title must be at least ${settings.shortTitleLength} characters`,
    );
  }
  if (data.title.length > settings.longTitleLength) {
    throw new Error(
      `Title must not exceed ${settings.longTitleLength} characters`,
    );
  }

  // Validate description
  if (data.descriptionHtml.length < settings.shortDescriptionLength) {
    throw new Error(
      `Description must be at least ${settings.shortDescriptionLength} characters`,
    );
  }
  if (data.descriptionHtml.length > settings.longDescriptionLength) {
    throw new Error(
      `Description must not exceed ${settings.longDescriptionLength} characters`,
    );
  }

  // Update product content
  await productBusiness.updateProduct(graphql, recommendation.productId, {
    title: data.title,
    descriptionHtml: data.descriptionHtml,
  });

  return updateRecommendationStatus(data.id, "RESOLVED", {
    targetTitle: data.title,
  });
}

export async function updateMedia(
  graphql: AdminGraphqlClient,
  shop: string,
  data: {
    id: string;
    image: File;
  },
) {
  const recommendation = await findRecommendation(shop, data.id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) throw new Error("Product not found");

  // Upload and attach the image
  await productBusiness.updateImage(
    graphql,
    recommendation.productId,
    data.image,
  );

  return updateRecommendationStatus(data.id, "RESOLVED");
}

export function deleteRecommendations(shop: string) {
  return db.recommendation.deleteMany({ where: { shop } });
}
interface SettingsChanges {
  pricing: {
    minRevenueRate: boolean;
    maxRevenueRate: boolean;
    lowDiscountRate: boolean;
    highDiscountRate: boolean;
  };
  text: {
    shortTitle: boolean;
    longTitle: boolean;
    shortDescription: boolean;
    longDescription: boolean;
  };
  inventory: {
    understock: boolean;
    overstock: boolean;
    passive: boolean;
  };
}

export function updateRecommendationsForSettings(
  shop: string,
  changes: SettingsChanges,
) {
  // Collect all affected subtypes
  const subTypes: RecommendationSubType[] = [];

  // Pricing changes
  if (Object.values(changes.pricing).some(Boolean)) {
    if (changes.pricing.minRevenueRate) subTypes.push("CHEAP");
    if (changes.pricing.maxRevenueRate)
      subTypes.push("EXPENSIVE");
    if (changes.pricing.lowDiscountRate)
      subTypes.push("LOW_DISCOUNT");
    if (changes.pricing.highDiscountRate)
      subTypes.push("HIGH_DISCOUNT");
  }

  // Text changes
  if (Object.values(changes.text).some(Boolean)) {
    if (changes.text.shortTitle) subTypes.push("SHORT_TITLE");
    if (changes.text.longTitle) subTypes.push("LONG_TITLE");
    if (changes.text.shortDescription)
      subTypes.push("SHORT_DESCRIPTION");
    if (changes.text.longDescription)
      subTypes.push("LONG_DESCRIPTION");
  }

  // Inventory changes
  if (Object.values(changes.inventory).some(Boolean)) {
    if (changes.inventory.understock) subTypes.push("UNDERSTOCK");
    if (changes.inventory.overstock) subTypes.push("OVERSTOCK");
    if (changes.inventory.passive) subTypes.push("PASSIVE");
  }

  return publish(shop, { subTypes: subTypes });
}

export async function updateStock(
  graphql: AdminGraphqlClient,
  shop: string,
  data: {
    id: string;
    quantity: number;
  },
) {
  const recommendation = await findRecommendation(shop, data.id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) throw new Error("Product not found");
  if (!recommendation.variantId) throw new Error("Variant not found");

  // Update inventory level
  await variantBusiness.updateInventory(
    graphql,
    recommendation.variantId,
    data.quantity,
  );

  return updateRecommendationStatus(data.id, "RESOLVED");
}

export async function initializeAll(graphql: AdminGraphqlClient, shop: string) {
  await publish(shop, { premium: false });
  await variantBusiness.startBulkVariantMetricsOperation(graphql);
}

export async function archiveProduct(
  graphql: AdminGraphqlClient,
  shop: string,
  id: string,
) {
  const recommendation = await findRecommendation(shop, id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) throw new Error("Product not found");

  await productBusiness.updateProduct(graphql, recommendation.productId, { status: "ARCHIVED" });
  return updateRecommendationStatus(id, "RESOLVED");
}

export async function deleteVariant(
  graphql: AdminGraphqlClient,
  shop: string,
  id: string,
) {
  const recommendation = await findRecommendation(shop, id);
  if (!recommendation) throw new Error("Recommendation not found");
  if (!recommendation.productId) throw new Error("Product not found");
  if (!recommendation.variantId) throw new Error("Variant not found");

  await variantBusiness.deleteVariant(graphql, recommendation.productId, recommendation.variantId);
  return updateRecommendationStatus(id, "RESOLVED");
}
