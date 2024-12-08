import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import db from "../db.server";

export async function initializeNoImageProducts(
  shop: string,
  graphql: AdminGraphqlClient,
) {
  await db.recommendation.deleteMany({
    where: { recommendationType: "NO_IMAGE", shop },
  });

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response: any = await graphql(
      `
        query getNoImageProducts($cursor: String) {
          products(
            first: 50
            after: $cursor
            query: "media:missing status:active"
          ) {
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
        variables: {
          cursor,
        },
      },
    );

    const {
      data: {
        products: { edges, pageInfo },
      },
    } = await response.json();

    // Filter products without images and save them to the database
    const noImageProducts = edges
      .filter(({ node }: any) => node.featuredMedia === null)
      .map(({ node }: any) => ({
        id: node.id,
        title: node.title,
      }));

    if (noImageProducts.length > 0) {
      for (const product of noImageProducts) {
        await db.recommendation.create({
          data: {
            shop,
            targetType: "PRODUCT",
            targetId: product.id,
            targetTitle: product.title,
            recommendationType: "NO_IMAGE",
            status: "PENDING",
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
    }

    // Update pagination info
    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = edges[edges.length - 1].cursor;
    }
  }
}

export async function listNoImageProducts(shop: string): Promise<
  Array<{
    id: string;
    targetId: string;
    targetTitle: string;
    createdAt: Date;
  }>
> {
  return await db.recommendation.findMany({
    where: { recommendationType: "NO_IMAGE", shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetId: true,
      targetTitle: true,
      createdAt: true,
    },
  });
}

export async function initializeShortTitleProducts(
  shop: string,
  graphql: AdminGraphqlClient,
) {
  await db.recommendation.deleteMany({
    where: { recommendationType: "SHORT_TITLE", shop },
  });

  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response: any = await graphql(
      `
        query getShortTitleProducts($cursor: String) {
          products(
            first: 50
            after: $cursor
            query: "status:active"
          ) {
            edges {
              node {
                id
                title
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
        variables: {
          cursor,
        },
      },
    );

    const {
      data: {
        products: { edges, pageInfo },
      },
    } = await response.json();

    const shortTitleProducts = edges
      .filter(({ node }: any) => node.title.length < 10)
      .map(({ node }: any) => ({
        id: node.id,
        title: node.title,
      }));

    if (shortTitleProducts.length > 0) {
      for (const product of shortTitleProducts) {
        await db.recommendation.create({
          data: {
            shop,
            targetType: "PRODUCT",
            targetId: product.id,
            targetTitle: product.title,
            recommendationType: "SHORT_TITLE",
            status: "PENDING",
            userActionRequired: true,
            actions: {
              create: {
                actionType: "UPDATE_TITLE",
                suggestedValue: "Consider using a more descriptive title",
              },
            },
          },
        });
      }
    }

    // Update pagination info
    hasNextPage = pageInfo.hasNextPage;
    if (hasNextPage) {
      cursor = edges[edges.length - 1].cursor;
    }
  }
}

export async function listShortTitleProducts(shop: string): Promise<
  Array<{
    id: string;
    targetId: string;
    targetTitle: string;
    createdAt: Date;
  }>
> {
  return await db.recommendation.findMany({
    where: { recommendationType: "SHORT_TITLE", shop },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      targetId: true,
      targetTitle: true,
      createdAt: true,
    },
  });
}
