import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import { authenticate } from "../shopify.server";

export async function getDetails(request: Request, variantId: string) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `query getVariant($id: ID!) {
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
      variables: { id: variantId },
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

export async function fetch(graphql: AdminGraphqlClient, cursor: string | null) {
  const response = await graphql(
    `
      query getProductVariants($cursor: String) {
        productVariants(first: 50, after: $cursor, query: "status:active") {
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
      }
    `,
    { variables: { cursor } },
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
    `
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
      }
    `,
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

export function deleteVariant(graphql: AdminGraphqlClient, productId: string, variantId: string) {
  return graphql(
    `
      mutation ProductVariantsDelete($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(
          productId: $productId
          variantsIds: $variantsIds
        ) {
          product {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        productId,
        variantsIds: [variantId],
      },
    },
  );
}

export async function isVariantDefault(graphql: AdminGraphqlClient, variantId: string): Promise<boolean> {
  const response = await graphql(
    `query getProductVariant($id: ID!) {
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
