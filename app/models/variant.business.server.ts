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
            inventoryQuantity
            inventoryItem {
              tracked
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

export async function updateInventory(
  graphql: AdminGraphqlClient,
  variantId: string,
  quantity: number
) {
  // First, get the inventory item ID and available locations
  const response = await graphql(
    `#graphql
    query getVariantInventory($id: ID!) {
      productVariant(id: $id) {
        inventoryItem {
          id
          tracked
          inventoryLevels(first: 1) {
            edges {
              node {
                location {
                  id
                }
              }
            }
          }
        }
      }
    }`,
    {
      variables: { id: variantId }
    }
  );

  const { data } = await response.json();
  const inventoryItemId = data.productVariant.inventoryItem.id;
  const locationId =
    data.productVariant.inventoryItem.inventoryLevels.edges[0]?.node.location
      .id;

  if (!locationId) {
    throw new Error('No location found for this variant');
  }

  // Then adjust the quantity
  const adjustResponse = await graphql(
    `#graphql
    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
      inventoryAdjustQuantities(input: $input) {
        userErrors {
          field
          message
        }
        inventoryAdjustmentGroup {
          createdAt
          changes {
            name
            delta
          }
        }
      }
    }`,
    {
      variables: {
        input: {
          reason: "correction",
          name: "available",
          changes: [
            {
              delta: quantity,
              inventoryItemId,
              locationId
            }
          ]
        }
      }
    }
  );

  return adjustResponse.json();
}
