import {
  RecommendationType,
  RecommendationStatus,
  TargetType,
} from "@prisma/client";
import type { Recommendation, RecommendationSubType, Settings, Prisma } from "@prisma/client";
import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import {
  getProductUrlFromGid,
  getProductVariantUrlFromGid,
} from "../utils/url.server";
import db from "../db.server";
import * as productBusiness from "./product.business.server";
import * as variantBusiness from "./variant.business.server";
import * as settingsBusiness from "./settings.business.server";
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

function getPricingCriteria(
  settings: Settings,
  recommendationSubTypes?: RecommendationSubType[],
) {
  let criterias = Object.entries({
    NO_COST: {
      filter: (node: ProductVariantNode) =>
        node.inventoryItem?.unitCost === null,
    },
    FREE: {
      filter: (node: ProductVariantNode) => {
        const price = Number(node.price ?? 0);
        return price === 0;
      },
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
    NO_DISCOUNT: {
      filter: (node: ProductVariantNode) => {
        const price = Number(node.price ?? 0);
        const compareAtPrice = Number(node.compareAtPrice ?? 0);
        if (!compareAtPrice) return false;
        return compareAtPrice <= price;
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

  if (recommendationSubTypes) {
    criterias = criterias.filter(([subType]) =>
      recommendationSubTypes.includes(subType as RecommendationSubType),
    );
  }

  return criterias;
}

function getTextCriteria(
  settings: Settings,
  recommendationSubTypes?: RecommendationSubType[],
) {
  let criterias = Object.entries({
    SHORT_TITLE: {
      filter: (node: ProductNode) =>
        node.title.length < settings.shortTitleLength,
    },
    LONG_TITLE: {
      filter: (node: ProductNode) =>
        node.title.length > settings.longTitleLength,
    },
    SHORT_DESCRIPTION: {
      filter: (node: ProductNode) =>
        node.description.length < settings.shortDescriptionLength,
    },
    LONG_DESCRIPTION: {
      filter: (node: ProductNode) =>
        node.description.length > settings.longDescriptionLength,
    },
  });

  if (recommendationSubTypes) {
    criterias = criterias.filter(([subType]) =>
      recommendationSubTypes.includes(subType as RecommendationSubType),
    );
  }

  return criterias;
}

function getMediaCriteria(
  _settings: Settings,
  recommendationSubTypes?: RecommendationSubType[],
) {
  let criterias = Object.entries({
    NO_IMAGE: {
      filter: (node: ProductNode) => node.featuredMedia === null,
    },
  });

  if (recommendationSubTypes) {
    criterias = criterias.filter(([subType]) =>
      recommendationSubTypes.includes(subType as RecommendationSubType),
    );
  }

  return criterias;
}

function getStockCriteria(
  _settings: Settings,
  recommendationSubTypes?: RecommendationSubType[],
) {
  let criterias = Object.entries({
    NO_STOCK: {
      type: RecommendationType.STOCK,
      filter: (node: ProductVariantNode) => node.inventoryQuantity === 0 && node.inventoryItem.tracked,
    },
  });

  if (recommendationSubTypes) {
    criterias = criterias.filter(([subType]) =>
      recommendationSubTypes.includes(subType as RecommendationSubType),
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

async function getProductRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  settings: Settings,
  params: {
    productId?: string;
    recommendationSubTypes?: RecommendationSubType[];
  } = {},
) {
  const textCriterias = getTextCriteria(
    settings,
    params?.recommendationSubTypes,
  );
  const mediaCriterias = getMediaCriteria(
    settings,
    params?.recommendationSubTypes,
  );
  const stockCriterias = getStockCriteria(
    settings,
    params?.recommendationSubTypes,
  );
  if (textCriterias.length === 0 && mediaCriterias.length === 0 && stockCriterias.length === 0) return [];

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const { edges, pageInfo } = await productBusiness.fetchProduct(graphql, {
      cursor,
      productId: params?.productId,
    });

    for (const { node } of edges) {
      if (textCriterias.length > 0) {
        const textIssues = textCriterias
          .filter(([, criteria]) => criteria.filter(node))
          .map(([subType]) => subType as RecommendationSubType);

        if (textIssues.length > 0) {
          recommendations.push({
            shop,
            targetType: TargetType.PRODUCT,
            productId: node.id,
            variantId: null,
            targetTitle: node.title,
            targetUrl: getProductUrlFromGid(node.id),
            type: RecommendationType.TEXT,
            subTypes: textIssues,
            status: RecommendationStatus.PENDING,
          });
        }
      }

      if (mediaCriterias.length > 0) {
        const mediaIssues = mediaCriterias
          .filter(([, criteria]) => criteria.filter(node))
          .map(([subType]) => subType as RecommendationSubType);

        if (mediaIssues.length > 0) {
          recommendations.push({
            shop,
            targetType: TargetType.PRODUCT,
            productId: node.id,
            variantId: null,
            targetTitle: node.title,
            targetUrl: getProductUrlFromGid(node.id),
            type: RecommendationType.MEDIA,
            subTypes: mediaIssues,
            status: RecommendationStatus.PENDING,
          });
        }
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
    recommendationSubTypes?: RecommendationSubType[];
  } = {},
) {
  const pricingCriterias = getPricingCriteria(
    settings,
    params?.recommendationSubTypes,
  );

  const stockCriterias = getStockCriteria(
    settings,
    params?.recommendationSubTypes,
  );
  if (
    pricingCriterias.length === 0 &&
    stockCriterias.length === 0
  )
    return [];

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
      const targetType = isVariantDefault
        ? TargetType.PRODUCT
        : TargetType.PRODUCT_VARIANT;
      const targetTitle = isVariantDefault
        ? node.product.title
        : `${node.product.title} - ${node.title}`;
      const targetUrl = getProductVariantUrlFromGid(
        node.product.id,
        node.id,
        isVariantDefault,
      );

      if (pricingCriterias.length > 0) {
        const pricingIssues = pricingCriterias
          .filter(([, criteria]) => criteria.filter(node))
          .map(([subType]) => subType as RecommendationSubType);

        if (pricingIssues.length > 0) {
          recommendations.push({
            shop,
            targetType,
            productId: node.product.id,
            variantId: node.id,
            targetTitle,
            targetUrl,
            type: RecommendationType.PRICING,
            subTypes: pricingIssues,
            status: RecommendationStatus.PENDING,
          });
        }
      }

      if (stockCriterias.length > 0) {
        const stockIssues = stockCriterias
          .filter(([, criteria]) => criteria.filter(node))
          .map(([subType]) => subType as RecommendationSubType);

        if (stockIssues.length > 0) {
          recommendations.push({
            shop,
            targetType,
            productId: node.product.id,
            variantId: node.id,
            targetTitle,
            targetUrl,
            type: RecommendationType.STOCK,
            subTypes: stockIssues,
            status: RecommendationStatus.PENDING,
          });
        }
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = hasNextPage ? edges[edges.length - 1].cursor : null;
  }

  return recommendations;
}

export function getRecommendationsByType(
  shop: string,
  type: RecommendationType,
  status: RecommendationStatus,
  page: number,
  size: number,
) {
  const skip = (page - 1) * size;
  return db.recommendation.findMany({
    where: {
      shop,
      type,
      status,
    },
    skip,
    take: size,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecommendationCounts(
  shop: string,
  status: RecommendationStatus,
): Promise<Record<RecommendationType, number>> {
  const recommendations = await db.recommendation.groupBy({
    by: ["type"],
    where: {
      shop,
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

export async function generateRecommendations(
  graphql: AdminGraphqlClient,
  shop: string,
  params: {
    productId?: string;
    recommendationSubTypes?: RecommendationSubType[];
  } = {},
) {
  console.info("Generating recommendations", { shop, params });
  const settings = await settingsBusiness.getShopSettings(shop);

  const recommendations: Prisma.RecommendationCreateManyInput[] = [];
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

  await db.recommendation.deleteMany({
    where: {
      shop,
      status: RecommendationStatus.PENDING,
      ...(params?.recommendationSubTypes && {
        subTypes: { hasSome: params?.recommendationSubTypes },
      }),
      ...(params?.productId && { productId: params?.productId }),
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
    id: string,
    image: File,
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
  const recommendationSubTypes: RecommendationSubType[] = [];

  // Pricing changes
  if (Object.values(changes.pricing).some(Boolean)) {
    if (changes.pricing.minRevenueRate) recommendationSubTypes.push("CHEAP");
    if (changes.pricing.maxRevenueRate) recommendationSubTypes.push("EXPENSIVE");
    if (changes.pricing.lowDiscountRate) recommendationSubTypes.push("LOW_DISCOUNT");
    if (changes.pricing.highDiscountRate) recommendationSubTypes.push("HIGH_DISCOUNT");
  }

  // Text changes
  if (Object.values(changes.text).some(Boolean)) {
    if (changes.text.shortTitle) recommendationSubTypes.push("SHORT_TITLE");
    if (changes.text.longTitle) recommendationSubTypes.push("LONG_TITLE");
    if (changes.text.shortDescription)
      recommendationSubTypes.push("SHORT_DESCRIPTION");
    if (changes.text.longDescription)
      recommendationSubTypes.push("LONG_DESCRIPTION");
  }

  // Inventory changes
  if (Object.values(changes.inventory).some(Boolean)) {
    if (changes.inventory.understock) recommendationSubTypes.push("UNDERSTOCK");
    if (changes.inventory.overstock) recommendationSubTypes.push("OVERSTOCK");
    if (changes.inventory.passive) recommendationSubTypes.push("PASSIVE");
  }

  return publish(shop, { recommendationSubTypes });
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
    data.quantity
  );

  return updateRecommendationStatus(data.id, "RESOLVED");
}
