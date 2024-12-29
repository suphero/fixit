import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../../shopify.server";
import db from "../../db.server";
import { getShopSettings } from "../../models/settings.business.server";
import { RecommendationType, RecommendationStatus, TargetType } from "@prisma/client";
import type { RecommendationSubType } from "@prisma/client";
import { getProductUrlFromGid } from "../../utils/url.server";

interface ProductCreatePayload {
  id: number;
  admin_graphql_api_id: string;
  title: string;
  body_html: string;
  images: any[];
  variants: Array<{
    id: number;
    admin_graphql_api_id: string;
    price: string;
    compare_at_price: string | null;
    inventory_quantity: number;
  }>;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);
  const productPayload = payload as ProductCreatePayload;
  const settings = await getShopSettings(shop);

  try {
    const recommendations: Array<{
      type: RecommendationType;
      targetType: TargetType;
      subTypes: RecommendationSubType[];
      variantId?: string | null;
    }> = [];

    // Check for definition issues
    const definitionSubTypes: RecommendationSubType[] = [];

    // Check title length
    if (productPayload.title.length < settings.shortTitleLength) {
      definitionSubTypes.push("SHORT_TITLE");
    } else if (productPayload.title.length > settings.longTitleLength) {
      definitionSubTypes.push("LONG_TITLE");
    }

    // Check description length
    const description = productPayload.body_html?.replace(/<[^>]*>/g, '') || '';
    if (description.length < settings.shortDescriptionLength) {
      definitionSubTypes.push("SHORT_DESCRIPTION");
    } else if (description.length > settings.longDescriptionLength) {
      definitionSubTypes.push("LONG_DESCRIPTION");
    }

    // Check for images
    if (!productPayload.images || productPayload.images.length === 0) {
      definitionSubTypes.push("NO_IMAGE");
    }

    if (definitionSubTypes.length > 0) {
      recommendations.push({
        type: RecommendationType.DEFINITION,
        targetType: TargetType.PRODUCT,
        subTypes: definitionSubTypes,
      });
    }

    // Check for stock issues
    const totalInventory = productPayload.variants.reduce(
      (sum, variant) => sum + (variant.inventory_quantity || 0),
      0
    );

    if (totalInventory === 0) {
      recommendations.push({
        type: RecommendationType.STOCK,
        targetType: TargetType.PRODUCT,
        subTypes: ["NO_STOCK"],
      });
    }

    // Check for pricing issues in variants
    for (const variant of productPayload.variants) {
      const pricingSubTypes: RecommendationSubType[] = [];
      const price = Number(variant.price);
      const compareAtPrice = variant.compare_at_price ? Number(variant.compare_at_price) : null;

      if (price === 0) {
        pricingSubTypes.push("FREE");
      }

      if (compareAtPrice) {
        if (compareAtPrice <= price) {
          pricingSubTypes.push("NO_DISCOUNT");
        } else {
          const discountPercentage = ((compareAtPrice - price) / compareAtPrice) * 100;
          if (discountPercentage < settings.lowDiscountRate) {
            pricingSubTypes.push("LOW_DISCOUNT");
          }
          if (discountPercentage > settings.highDiscountRate) {
            pricingSubTypes.push("HIGH_DISCOUNT");
          }
        }
      }

      if (pricingSubTypes.length > 0) {
        recommendations.push({
          type: RecommendationType.PRICING,
          targetType: productPayload.variants.length === 1 ? TargetType.PRODUCT : TargetType.PRODUCT_VARIANT,
          subTypes: pricingSubTypes,
          variantId: variant.admin_graphql_api_id,
        });
      }
    }

    // Create recommendations if any issues found
    if (recommendations.length > 0) {
      await db.recommendation.createMany({
        data: recommendations.map(reco => ({
          shop,
          targetType: reco.targetType,
          productId: productPayload.admin_graphql_api_id,
          variantId: reco.variantId,
          targetTitle: productPayload.title,
          targetUrl: getProductUrlFromGid(productPayload.admin_graphql_api_id),
          type: reco.type,
          subTypes: reco.subTypes,
          status: RecommendationStatus.PENDING,
        })),
      });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Product create webhook error:", error);
    return new Response(null, { status: 200 });
  }
};
