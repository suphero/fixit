import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import type { RecommendationType } from "@prisma/client";
import { ActionType, TargetType } from "@prisma/client";
import db from "../db.server";

// NO_IMAGE -> ARCHIVE / UPLOAD_IMAGE
// SHORT_TITLE -> UPDATE_TITLE
// LONG_TITLE -> UPDATE_TITLE
// SHORT_DESCRIPTION -> UPDATE_DESCRIPTION
// LONG_DESCRIPTION -> UPDATE_DESCRIPTION
// NO_STOCK -> ARCHIVE
// NO_COST -> DEFINE_COST

const PRODUCT_RECOMMENDATION_CRITERIA = {
  NO_IMAGE: {
    filter: (node: any) => node.featuredMedia === null,
    actionType: ActionType.UPLOAD_IMAGE,
    suggestedValue: "Upload an image for this product",
  },
  SHORT_TITLE: {
    filter: (node: any) => node.title.length < 10,
    actionType: ActionType.UPDATE_TITLE,
    suggestedValue: "Consider using a more descriptive title",
  },
  LONG_TITLE: {
    filter: (node: any) => node.title.length > 50,
    actionType: ActionType.UPDATE_TITLE,
    suggestedValue: "Consider using a shorter title",
  },
  SHORT_DESCRIPTION: {
    filter: (node: any) => node.description.length < 100,
    actionType: ActionType.UPDATE_DESCRIPTION,
    suggestedValue: "Consider using a more descriptive description",
  },
  LONG_DESCRIPTION: {
    filter: (node: any) => node.description.length > 1000,
    actionType: ActionType.UPDATE_DESCRIPTION,
    suggestedValue: "Consider using a shorter description",
  },
  NO_STOCK: {
    filter: (node: any) => node.totalInventory === 0,
    actionType: ActionType.DEFINE_COST,
    suggestedValue: "Define a cost for this product variant",
  },
};

const PRODUCT_VARIANT_RECOMMENDATION_CRITERIA = {
  NO_COST: {
    filter: (node: any) => node?.inventoryItem?.unitCost === null,
    actionType: ActionType.DEFINE_COST,
    suggestedValue: "Add a cost to this variant",
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
      {
        variables: { cursor },
      },
    );

    const {
      data: {
        products: { edges, pageInfo },
      },
    } = await response.json();

    for (const { node } of edges) {
      for (const [type, config] of Object.entries(
        PRODUCT_RECOMMENDATION_CRITERIA,
      )) {
        if (config.filter(node)) {
          await db.recommendation.create({
            data: {
              shop,
              targetType: TargetType.PRODUCT,
              targetId: node.id,
              targetTitle: node.title,
              recommendationType: type,
              status: "PENDING",
              userActionRequired: true,
              actions: {
                create: {
                  actionType: config.actionType,
                  suggestedValue: config.suggestedValue,
                },
              },
            },
          });
        }
      }
    }

    // Update pagination info
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
                inventoryItem {
                  unitCost {
                    amount
                  }
                }
                product {
                  id
                  title
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
      {
        variables: { cursor },
      },
    );

    const {
      data: {
        productVariants: { edges, pageInfo },
      },
    } = await response.json();

    for (const { node } of edges) {
      for (const [type, config] of Object.entries(
        PRODUCT_VARIANT_RECOMMENDATION_CRITERIA,
      )) {
        if (config.filter(node)) {
          await db.recommendation.create({
            data: {
              shop,
              targetType: TargetType.PRODUCT_VARIANT,
              targetId: node.id,
              targetTitle: `${node.product.title} - ${node.title}`,
              recommendationType: type,
              status: "PENDING",
              userActionRequired: true,
              actions: {
                create: {
                  actionType: config.actionType,
                  suggestedValue: config.suggestedValue,
                },
              },
            },
          });
        }
      }
    }

    // Update pagination info
    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = edges[edges.length - 1].cursor;
    }
  }
}

export async function findRecommendations(
  shop: string,
  recommendationType: RecommendationType,
) {
  return await db.recommendation.findMany({
    where: { recommendationType, shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetId: true,
      targetTitle: true,
      createdAt: true,
    },
  });
}
