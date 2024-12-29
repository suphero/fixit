import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";

export async function getDetails(graphql: AdminGraphqlClient, id: string) {
  const response = await graphql(
    `#graphql
    query getVariant($id: ID!) {
      productVariant(id: $id) {
        price
        compareAtPrice
        inventoryItem {
          unitCost {
            amount
          }
        }
      }
    }`,
    {
      variables: { id },
    },
  );

  const { data } = await response.json();
  const cost = data.productVariant.inventoryItem?.unitCost?.amount;
  const currentPrice = data.productVariant.price;
  const currentCompareAtPrice = data.productVariant.compareAtPrice;

  return {
    cost,
    currentPrice,
    currentCompareAtPrice,
  };
}

export async function fetchVariant(
  graphql: AdminGraphqlClient,
  params: { cursor: string | null; productId?: string },
) {
  let query = "status:active";
  if (params.productId) {
    query += ` AND product_id:${params.productId}`;
  }
  const response = await graphql(
    `#graphql
    query getProductVariants($cursor: String, $query: String) {
      productVariants(first: 50, after: $cursor, query: $query) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            inventoryItem {
              unitCost {
                amount
              }
            }
            product {
              id
              title
              hasOnlyDefaultVariant
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
        }
      }
    }`,
    { variables: { cursor: params.cursor, query } },
  );
  const { data } = await response.json();
  return data.productVariants;
}

export function updatePricing(
  graphql: AdminGraphqlClient,
  productId: string,
  variantId: string,
  price?: string,
  cost?: string,
  compareAtPrice?: string,
) {
  return graphql(
    `#graphql
    mutation ProductVariantsBulkUpdate(
      $productId: ID!
      $variants: [ProductVariantsBulkInput!]!
    ) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          compareAtPrice
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        productId,
        variants: [
          {
            id: variantId,
            price,
            compareAtPrice,
            inventoryItem: {
              cost,
            },
          },
        ],
      },
    },
  );
}

export async function isVariantDefault(graphql: AdminGraphqlClient, variantId: string): Promise<boolean> {
  const response = await graphql(
    `#graphql
    query getProductVariant($id: ID!) {
      productVariant(id: $id) {
        product {
          hasOnlyDefaultVariant
        }
      }
    }`,
    {
      variables: { id: variantId },
    },
  );

  const { data } = await response.json();
  return data.productVariant.product.hasOnlyDefaultVariant;
}
