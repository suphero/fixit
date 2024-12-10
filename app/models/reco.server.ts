import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import db from "../db.server";

const PRODUCT_RECOMMENDATION_CRITERIA = {
  NO_IMAGE: {
    filter: (node: any) => node.featuredMedia === null,
    actionType: "UPLOAD_IMAGE",
    suggestedValue: "Upload an image for this product",
  },
  SHORT_TITLE: {
    filter: (node: any) => node.title.length < 10,
    actionType: "UPDATE_TITLE",
    suggestedValue: "Consider using a more descriptive title",
  },
  LONG_TITLE: {
    filter: (node: any) => node.title.length > 50,
    actionType: "UPDATE_TITLE",
    suggestedValue: "Consider using a shorter title",
  },
};

export async function initializeAllProducts(
  shop: string,
  graphql: AdminGraphqlClient,
) {

  await db.recommendation.deleteMany({
    where: { shop },
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
              targetType: "PRODUCT",
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

export async function listProductsByType(
  shop: string,
  recommendationType: keyof typeof PRODUCT_RECOMMENDATION_CRITERIA,
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
