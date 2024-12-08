import type { GraphQLClient } from "graphql-request";
import db from "../db.server";

type ProductNode = {
  id: string;
  title: string;
  images: {
    nodes: { url: string }[];
  };
};

type ProductResponse = {
  products: {
    edges: { node: ProductNode; cursor: string }[];
    pageInfo: {
      hasNextPage: boolean;
    };
  };
};

export async function initializeNoImageProductSuggestions(
  shop: string,
  graphql: GraphQLClient,
): Promise<void> {
  db.recommendation.deleteMany({
    where: { recommendationType: "NO_IMAGE" },
  });
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response: ProductResponse = await graphql.request(
      `
        query getProductsWithoutImages($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                images(first: 1) {
                  nodes {
                    url
                  }
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
        first: 100,
        after: cursor,
      },
    );

    const productsWithoutImages = response.products.edges.filter(
      ({ node }) => node.images.nodes.length === 0,
    );

    for (const { node: product } of productsWithoutImages) {
      await db.recommendation.create({
        data: {
          shop,
          targetType: "PRODUCT",
          targetValue: product.id,
          recommendationType: "NO_IMAGE",
          currentValue: "No image found",
          status: "PENDING",
          reason: `Product '${product.title}' has no image`,
          userActionRequired: true,
          actions: {
            create: {
              actionType: "UPLOAD_IMAGE",
              suggestedValue: "Upload an image for this product",
            },
          },
        },
      });
    }

    hasNextPage = response.products.pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor =
        response.products.edges[response.products.edges.length - 1].cursor;
    }
  }
}

export async function listNoImageProductSuggestions(shop: string): Promise<
  Array<{
    id: string;
    targetValue: string;
    reason: string;
    createdAt: Date;
  }>
> {
  return await db.recommendation.findMany({
    where: { recommendationType: "NO_IMAGE", shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetValue: true,
      reason: true,
      createdAt: true,
    },
  });
}

export async function countNoImageProductSuggestions(shop: string): Promise<number> {
  return await db.recommendation.count({
    where: { recommendationType: "NO_IMAGE", shop },
  });
}
