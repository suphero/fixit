import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import type { Recommendation, Settings } from "@prisma/client";
import { calculateImpact } from "../utils/impact-calculator.server";
import db from "../db.server";

/**
 * Extended Recommendation with impact data
 */
export interface RecommendationWithImpact extends Recommendation {
  impact: {
    score: number;
    potentialRevenue: number;
    impactType: "positive" | "negative" | "neutral";
    calculation: string;
    assumptions: string[];
    confidence: "low" | "medium" | "high";
  };
}

/**
 * Fetch product/variant data for a recommendation
 */
async function fetchRecommendationData(
  graphql: AdminGraphqlClient,
  recommendation: Recommendation,
) {
  if (recommendation.targetType === "PRODUCT") {
    // Fetch product data
    const response = await graphql(
      `#graphql
      query getProduct($id: ID!) {
        product(id: $id) {
          title
          description
          variants(first: 1) {
            nodes {
              price
              inventoryQuantity
              inventoryItem {
                tracked
                unitCost {
                  amount
                }
              }
            }
          }
        }
      }`,
      { variables: { id: recommendation.productId } },
    );

    const { data } = await response.json();
    const product = data?.product;
    if (!product) return null;

    const variant = product.variants.nodes[0];
    return {
      title: product.title,
      description: product.description,
      price: parseFloat(variant?.price || "0"),
      cost: parseFloat(variant?.inventoryItem?.unitCost?.amount || "0"),
      inventoryQuantity: variant?.inventoryQuantity || 0,
      averageDailySales: 0.5, // Default, will be updated from metrics
    };
  } else {
    // Fetch variant data
    const response = await graphql(
      `#graphql
      query getVariant($id: ID!) {
        productVariant(id: $id) {
          price
          compareAtPrice
          inventoryQuantity
          inventoryItem {
            tracked
            unitCost {
              amount
            }
          }
          product {
            title
            description
          }
        }
      }`,
      { variables: { id: recommendation.variantId } },
    );

    const { data } = await response.json();
    const variant = data?.productVariant;
    if (!variant) return null;

    return {
      title: variant.product.title,
      description: variant.product.description,
      price: parseFloat(variant.price || "0"),
      cost: parseFloat(variant.inventoryItem?.unitCost?.amount || "0"),
      compareAtPrice: parseFloat(variant.compareAtPrice || "0"),
      inventoryQuantity: variant.inventoryQuantity || 0,
      averageDailySales: 0.5, // Default, will be updated from metrics
    };
  }
}

/**
 * Get variant metrics if available
 */
async function getVariantMetrics(shop: string, variantId: string) {
  const metric = await db.variantMetric.findUnique({
    where: {
      shop_variantId: {
        shop,
        variantId,
      },
    },
  });

  return metric?.averageDailySales || 0.5;
}

/**
 * Calculate and attach impact to a single recommendation
 */
export async function enrichRecommendationWithImpact(
  graphql: AdminGraphqlClient,
  shop: string,
  recommendation: Recommendation,
  settings: Settings,
): Promise<RecommendationWithImpact> {
  try {
    let productData = null;

    // 1. Try to use cached snapshot first (faster + works even if product deleted)
    if (recommendation.productSnapshot) {
      console.log(`[Impact] Using cached snapshot for ${recommendation.id}`);
      productData = recommendation.productSnapshot as any;
    }

    // 2. If no snapshot, fetch from Shopify API
    if (!productData) {
      console.log(`[Impact] Fetching fresh data from Shopify for ${recommendation.id}`);
      productData = await fetchRecommendationData(graphql, recommendation);

      if (!productData) {
        console.warn(`[Impact] Failed to fetch product data for recommendation ${recommendation.id}`, {
          productId: recommendation.productId,
          variantId: recommendation.variantId,
          targetType: recommendation.targetType,
        });

        // Return with default impact if data fetch fails
        return {
          ...recommendation,
          impact: {
            score: 0,
            potentialRevenue: 0,
            impactType: "neutral",
            calculation: "Unable to calculate - product data unavailable",
            assumptions: ["Product may have been deleted", "Try regenerating recommendations"],
            confidence: "low",
          },
        };
      }
    }

    // Get average daily sales from metrics if variant exists
    if (recommendation.variantId) {
      const avgSales = await getVariantMetrics(shop, recommendation.variantId);
      productData.averageDailySales = avgSales;
    }

    // Calculate impact for the primary subtype
    const primarySubType = recommendation.subTypes[0];
    const impactResult = calculateImpact(
      recommendation.type,
      primarySubType,
      productData,
      settings,
    );

    return {
      ...recommendation,
      impact: {
        score: impactResult.impactScore,
        potentialRevenue: impactResult.potentialRevenue,
        impactType: impactResult.impactType,
        calculation: impactResult.impactMetadata.calculation,
        assumptions: impactResult.impactMetadata.assumptions,
        confidence: impactResult.impactMetadata.confidence,
      },
    };
  } catch (error) {
    console.error("Error enriching recommendation with impact:", error);
    return {
      ...recommendation,
      impact: {
        score: 0,
        potentialRevenue: 0,
        impactType: "neutral",
        calculation: "Calculation error",
        assumptions: ["Error occurred during calculation"],
        confidence: "low",
      },
    };
  }
}

/**
 * Calculate and attach impact to multiple recommendations
 */
export async function enrichRecommendationsWithImpact(
  graphql: AdminGraphqlClient,
  shop: string,
  recommendations: Recommendation[],
  settings: Settings,
): Promise<RecommendationWithImpact[]> {
  // Process in parallel with a limit to avoid rate limiting
  const batchSize = 5;
  const results: RecommendationWithImpact[] = [];

  for (let i = 0; i < recommendations.length; i += batchSize) {
    const batch = recommendations.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((rec) =>
        enrichRecommendationWithImpact(graphql, shop, rec, settings),
      ),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Calculate total potential impact for all recommendations
 */
export function calculateTotalImpact(recommendations: RecommendationWithImpact[]) {
  const totals = recommendations.reduce(
    (acc, rec) => {
      acc.totalRevenue += rec.impact.potentialRevenue;
      acc.positiveImpact += rec.impact.impactType === "positive" ? rec.impact.potentialRevenue : 0;
      acc.negativeImpact += rec.impact.impactType === "negative" ? rec.impact.potentialRevenue : 0;
      acc.avgScore += rec.impact.score;
      acc.count += 1;
      return acc;
    },
    {
      totalRevenue: 0,
      positiveImpact: 0,
      negativeImpact: 0,
      avgScore: 0,
      count: 0,
    },
  );

  return {
    totalRevenue: totals.totalRevenue,
    positiveImpact: totals.positiveImpact,
    negativeImpact: totals.negativeImpact,
    averageScore: totals.count > 0 ? totals.avgScore / totals.count : 0,
    count: totals.count,
  };
}
