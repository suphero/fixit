import type { RecommendationSubType, Settings } from "@prisma/client";

/**
 * Impact Calculator - Calculates potential revenue impact for each recommendation type
 */

export interface ImpactResult {
  impactScore: number; // 0-100
  potentialRevenue: number; // Estimated monthly revenue change
  impactType: "positive" | "negative" | "neutral";
  impactMetadata: {
    calculation: string;
    assumptions: string[];
    confidence: "low" | "medium" | "high";
  };
}

interface ProductData {
  price: number;
  cost?: number;
  compareAtPrice?: number;
  inventoryQuantity?: number;
  averageDailySales?: number;
  title?: string;
  description?: string;
}

/**
 * Calculate impact for pricing recommendations
 */
export function calculatePricingImpact(
  subType: RecommendationSubType,
  productData: ProductData,
  settings: Settings,
): ImpactResult {
  const { price, cost = 0, compareAtPrice = 0, averageDailySales = 0.5 } = productData;

  switch (subType) {
    case "SALE_AT_LOSS": {
      // Critical: Selling below cost
      const lossPerUnit = cost - price;
      const monthlyLoss = lossPerUnit * averageDailySales * 30;
      return {
        impactScore: 95,
        potentialRevenue: Math.abs(monthlyLoss),
        impactType: "negative",
        impactMetadata: {
          calculation: `Recovering loss: $${lossPerUnit.toFixed(2)}/unit × ${(averageDailySales * 30).toFixed(0)} units/month`,
          assumptions: [
            `Current loss: $${lossPerUnit.toFixed(2)} per sale`,
            `Estimated ${(averageDailySales * 30).toFixed(0)} sales/month`,
          ],
          confidence: "high",
        },
      };
    }

    case "FREE": {
      // Products priced at $0
      const suggestedPrice = cost > 0 ? cost * (1 + settings.minRevenueRate / 100) : 10;
      const monthlyRevenue = suggestedPrice * averageDailySales * 30;
      return {
        impactScore: 90,
        potentialRevenue: monthlyRevenue,
        impactType: "positive",
        impactMetadata: {
          calculation: `$${suggestedPrice.toFixed(2)}/unit × ${(averageDailySales * 30).toFixed(0)} units/month`,
          assumptions: [
            `Suggested price: $${suggestedPrice.toFixed(2)}`,
            "Currently giving away for free",
          ],
          confidence: "medium",
        },
      };
    }

    case "CHEAP": {
      // Price below minimum revenue rate
      const targetPrice = cost * (1 + settings.minRevenueRate / 100);
      const additionalRevenuePerUnit = targetPrice - price;
      const monthlyRevenue = additionalRevenuePerUnit * averageDailySales * 30;
      return {
        impactScore: 70,
        potentialRevenue: monthlyRevenue,
        impactType: "positive",
        impactMetadata: {
          calculation: `+$${additionalRevenuePerUnit.toFixed(2)}/unit × ${(averageDailySales * 30).toFixed(0)} units/month`,
          assumptions: [
            `Current margin: ${((price - cost) / cost * 100).toFixed(0)}%`,
            `Target margin: ${settings.minRevenueRate}%`,
          ],
          confidence: "high",
        },
      };
    }

    case "EXPENSIVE": {
      // Price above maximum revenue rate (may reduce sales)
      const targetPrice = cost * (1 + settings.maxRevenueRate / 100);
      const overpricing = price - targetPrice;
      const estimatedSalesLoss = averageDailySales * 0.2; // Assume 20% sales drop
      const potentialLoss = overpricing * estimatedSalesLoss * 30;
      return {
        impactScore: 60,
        potentialRevenue: potentialLoss,
        impactType: "negative",
        impactMetadata: {
          calculation: `Potential sales recovery: ${(estimatedSalesLoss * 30).toFixed(0)} units/month`,
          assumptions: [
            `Currently ${((price - cost) / cost * 100).toFixed(0)}% margin`,
            "May be losing 20% of potential sales due to high price",
          ],
          confidence: "medium",
        },
      };
    }

    case "NO_DISCOUNT":
    case "LOW_DISCOUNT": {
      // Minimal discount impact
      const potentialSalesIncrease = averageDailySales * 0.15; // 15% sales increase
      const monthlyRevenue = price * potentialSalesIncrease * 30;
      return {
        impactScore: 40,
        potentialRevenue: monthlyRevenue,
        impactType: "positive",
        impactMetadata: {
          calculation: `${(potentialSalesIncrease * 30).toFixed(0)} additional sales/month × $${price.toFixed(2)}`,
          assumptions: [
            "Adding discount may increase sales by ~15%",
            "Small psychological pricing boost",
          ],
          confidence: "low",
        },
      };
    }

    case "HIGH_DISCOUNT": {
      // Excessive discount - losing margin
      const currentDiscountPercent = ((compareAtPrice - price) / compareAtPrice) * 100;
      const targetDiscountPercent = settings.highDiscountRate;
      const excessDiscount = (currentDiscountPercent - targetDiscountPercent) / 100;
      const lossPerUnit = compareAtPrice * excessDiscount;
      const monthlyLoss = lossPerUnit * averageDailySales * 30;
      return {
        impactScore: 75,
        potentialRevenue: monthlyLoss,
        impactType: "negative",
        impactMetadata: {
          calculation: `Reducing discount from ${currentDiscountPercent.toFixed(0)}% to ${targetDiscountPercent}%`,
          assumptions: [
            `Losing $${lossPerUnit.toFixed(2)} per sale due to excess discount`,
            "Discount may be unnecessarily high",
          ],
          confidence: "medium",
        },
      };
    }

    case "NO_COST": {
      // Missing cost data - can't calculate margin
      return {
        impactScore: 30,
        potentialRevenue: 0,
        impactType: "neutral",
        impactMetadata: {
          calculation: "Enable profit tracking by adding cost",
          assumptions: [
            "Cannot calculate profitability without cost data",
            "Add cost to unlock pricing insights",
          ],
          confidence: "low",
        },
      };
    }

    default:
      return getDefaultImpact();
  }
}

/**
 * Calculate impact for text/SEO recommendations
 */
export function calculateTextImpact(
  subType: RecommendationSubType,
  productData: ProductData,
): ImpactResult {
  const { price = 0, averageDailySales = 0.5 } = productData;

  switch (subType) {
    case "SHORT_TITLE":
    case "SHORT_DESCRIPTION": {
      // Poor SEO and conversion
      const estimatedConversionIncrease = 0.1; // 10% conversion lift
      const additionalSales = averageDailySales * estimatedConversionIncrease * 30;
      const monthlyRevenue = additionalSales * price;
      return {
        impactScore: 55,
        potentialRevenue: monthlyRevenue,
        impactType: "positive",
        impactMetadata: {
          calculation: `+${additionalSales.toFixed(0)} sales/month × $${price.toFixed(2)}`,
          assumptions: [
            "Better content improves SEO ranking",
            "~10% conversion rate improvement",
            "Better product discoverability",
          ],
          confidence: "medium",
        },
      };
    }

    case "LONG_TITLE":
    case "LONG_DESCRIPTION": {
      // Overly verbose - may reduce conversions
      const estimatedConversionDecrease = 0.05; // 5% conversion drop
      const lostSales = averageDailySales * estimatedConversionDecrease * 30;
      const monthlyLoss = lostSales * price;
      return {
        impactScore: 45,
        potentialRevenue: monthlyLoss,
        impactType: "negative",
        impactMetadata: {
          calculation: `Preventing loss of ${lostSales.toFixed(0)} sales/month`,
          assumptions: [
            "Verbose content may overwhelm customers",
            "~5% potential conversion loss",
            "Mobile users prefer concise content",
          ],
          confidence: "low",
        },
      };
    }

    default:
      return getDefaultImpact();
  }
}

/**
 * Calculate impact for media recommendations
 */
export function calculateMediaImpact(
  subType: RecommendationSubType,
  productData: ProductData,
): ImpactResult {
  const { price = 0, averageDailySales = 0.5 } = productData;

  if (subType === "NO_IMAGE") {
    // Critical: No product image dramatically hurts sales
    const conversionPenalty = 0.8; // 80% conversion loss without image
    const lostSales = averageDailySales * conversionPenalty * 30;
    const monthlyLoss = lostSales * price;
    return {
      impactScore: 100,
      potentialRevenue: monthlyLoss,
      impactType: "negative",
      impactMetadata: {
        calculation: `Recovering ${lostSales.toFixed(0)} lost sales/month`,
        assumptions: [
          "Products without images lose ~80% of potential sales",
          "Images are critical for e-commerce conversion",
          "Immediate high-priority fix",
        ],
        confidence: "high",
      },
    };
  }

  return getDefaultImpact();
}

/**
 * Calculate impact for inventory recommendations
 */
export function calculateStockImpact(
  subType: RecommendationSubType,
  productData: ProductData,
  settings: Settings,
): ImpactResult {
  const { price = 0, averageDailySales = 0.5, inventoryQuantity = 0 } = productData;

  switch (subType) {
    case "NO_STOCK": {
      // Out of stock - losing all sales
      const lostSales = averageDailySales * 30;
      const monthlyLoss = lostSales * price;
      return {
        impactScore: 95,
        potentialRevenue: monthlyLoss,
        impactType: "negative",
        impactMetadata: {
          calculation: `Losing ${lostSales.toFixed(0)} sales/month`,
          assumptions: [
            "Currently out of stock",
            `Losing $${(averageDailySales * price).toFixed(2)}/day`,
            "Immediate restocking needed",
          ],
          confidence: "high",
        },
      };
    }

    case "UNDERSTOCK": {
      // Low stock - risk of stockout
      const daysOfStock = inventoryQuantity / averageDailySales;
      const stockoutRisk = Math.max(0, (settings.understockDays - daysOfStock) / settings.understockDays);
      const potentialLostSales = averageDailySales * 30 * stockoutRisk * 0.5;
      const monthlyLoss = potentialLostSales * price;
      return {
        impactScore: 70,
        potentialRevenue: monthlyLoss,
        impactType: "negative",
        impactMetadata: {
          calculation: `${daysOfStock.toFixed(0)} days of stock remaining`,
          assumptions: [
            `Risk of stockout in ${daysOfStock.toFixed(0)} days`,
            `May lose ${potentialLostSales.toFixed(0)} sales if out of stock`,
            "Restock to prevent lost revenue",
          ],
          confidence: "medium",
        },
      };
    }

    case "OVERSTOCK": {
      // Excess inventory - capital tied up
      const excessUnits = inventoryQuantity - (averageDailySales * settings.overstockDays);
      const capitalTiedUp = excessUnits * (productData.cost || price * 0.6);
      return {
        impactScore: 50,
        potentialRevenue: capitalTiedUp * 0.02, // 2% monthly opportunity cost
        impactType: "negative",
        impactMetadata: {
          calculation: `$${capitalTiedUp.toFixed(2)} capital tied up in excess inventory`,
          assumptions: [
            `${excessUnits.toFixed(0)} excess units`,
            "Could invest capital elsewhere",
            "~2% monthly opportunity cost",
          ],
          confidence: "medium",
        },
      };
    }

    case "PASSIVE": {
      // Inactive product - dead inventory
      const capitalTiedUp = inventoryQuantity * (productData.cost || price * 0.6);
      return {
        impactScore: 60,
        potentialRevenue: capitalTiedUp * 0.03, // 3% monthly loss
        impactMetadata: {
          calculation: `$${capitalTiedUp.toFixed(2)} in dead inventory`,
          assumptions: [
            `No sales in ${settings.passiveDays} days`,
            "Consider archiving or discounting",
            "Freeing up capital for better products",
          ],
          confidence: "medium",
        },
        impactType: "negative",
      };
    }

    default:
      return getDefaultImpact();
  }
}

/**
 * Main calculator function
 */
export function calculateImpact(
  type: string,
  subType: RecommendationSubType,
  productData: ProductData,
  settings: Settings,
): ImpactResult {
  switch (type) {
    case "PRICING":
      return calculatePricingImpact(subType, productData, settings);
    case "TEXT":
      return calculateTextImpact(subType, productData);
    case "MEDIA":
      return calculateMediaImpact(subType, productData);
    case "STOCK":
      return calculateStockImpact(subType, productData, settings);
    default:
      return getDefaultImpact();
  }
}

function getDefaultImpact(): ImpactResult {
  return {
    impactScore: 0,
    potentialRevenue: 0,
    impactType: "neutral",
    impactMetadata: {
      calculation: "N/A",
      assumptions: [],
      confidence: "low",
    },
  };
}
