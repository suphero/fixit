import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import db from "../db.server";
import * as shopBusiness from "./shop.business.server";
import { publish } from "app/consumers/generate-reco.server";
import { withThrottleRetry } from "../utils/graphql.server";

interface BulkVariantMetrics {
  variantId: string;
  variantCreatedAt: Date;
  lastOrderDate: Date | null;
  totalSold: number;
  averageDailySales: number;
}

export async function getDetails(graphql: AdminGraphqlClient, id: string) {
  const response = await graphql(
    `#graphql
    query getVariant($id: ID!) {
      productVariant(id: $id) {
        price
        compareAtPrice
        inventoryQuantity
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
  const inventoryQuantity = data.productVariant.inventoryQuantity;

  return {
    cost,
    currentPrice,
    currentCompareAtPrice,
    inventoryQuantity,
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
  const { data } = await withThrottleRetry(
    async () => {
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
      return response.json();
    },
    "fetchVariant",
  );
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

export async function updateInventory(
  graphql: AdminGraphqlClient,
  variantId: string,
  quantity: number,
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
      variables: { id: variantId },
    },
  );

  const { data } = await response.json();
  const inventoryItemId = data.productVariant.inventoryItem.id;
  const locationId =
    data.productVariant.inventoryItem.inventoryLevels.edges[0]?.node.location
      .id;

  if (!locationId) {
    throw new Error("No location found for this variant");
  }

  // Then adjust the quantity
  const adjustResponse = await graphql(
    `#graphql
    mutation inventoryAdjustQuantities(
      $input: InventoryAdjustQuantitiesInput!
    ) {
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
              locationId,
            },
          ],
        },
      },
    },
  );

  return adjustResponse.json();
}

async function calculateAndStoreVariantMetrics(
  shop: string,
  metrics: {
    variantId: string;
    variantCreatedAt: Date;
    lastOrderDate: Date | null;
    totalSold: number;
    inventoryQuantity: number;
  },
) {
  const { variantId, variantCreatedAt, lastOrderDate, totalSold } = metrics;

  // Calculate average daily sales
  let averageDailySales = 0;
  const daysSinceFirstOrder = Math.max(
    1,
    Math.floor((new Date().getTime() - variantCreatedAt.getTime()) / (1000 * 60 * 60 * 24))
  );
  averageDailySales = totalSold / daysSinceFirstOrder;

  return db.variantMetric.upsert({
    where: { shop_variantId: { shop, variantId } },
    create: {
      shop,
      variantId,
      variantCreatedAt,
      lastOrderDate,
      totalSold,
      averageDailySales,
    },
    update: {
      variantCreatedAt,
      lastOrderDate,
      totalSold,
      averageDailySales,
    },
  });
}

export async function getVariantMetricsForUser(
  shop: string,
  variantId: string,
): Promise<BulkVariantMetrics | null> {
  const shopDetails = await shopBusiness.getShop(shop);
  const isFree = shopDetails?.subscriptionName !== "Premium";
  if (isFree) {
    return null;
  }
  return getVariantMetrics(shop, variantId);
}

export async function getVariantMetrics(
  shop: string,
  variantId: string,
): Promise<BulkVariantMetrics | null> {
  const data = await db.variantMetric.findUnique({
    where: { shop_variantId: { shop, variantId } },
  });

  if (!data) return null;

  return {
    variantId: data.variantId,
    variantCreatedAt: data.variantCreatedAt,
    lastOrderDate: data.lastOrderDate,
    totalSold: data.totalSold,
    averageDailySales: data.averageDailySales,
  };
}

export function getStockStatus(
  metrics: {
    lastOrderDate: Date | null;
    averageDailySales: number;
    inventoryQuantity: number;
  },
  settings: {
    passiveDays: number;
    understockDays: number;
    overstockDays: number;
  }
): 'PASSIVE' | 'UNDERSTOCK' | 'OVERSTOCK' | null {
  const now = new Date();

  // Check for passive products
  if (metrics.lastOrderDate) {
    const daysSinceLastOrder = Math.floor(
      (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastOrder > settings.passiveDays) {
      return 'PASSIVE';
    }
  }

  // Skip if no sales history
  if (metrics.averageDailySales === 0) {
    return null;
  }

  // Calculate stock status
  const daysOfStock = metrics.inventoryQuantity / metrics.averageDailySales;

  if (daysOfStock < settings.understockDays) {
    return 'UNDERSTOCK';
  }

  if (daysOfStock > settings.overstockDays) {
    return 'OVERSTOCK';
  }

  return null;
}

const getOneYearBefore = () => {
  const now = new Date();
  now.setFullYear(now.getFullYear() - 1);
  const formattedDate = now.toISOString().split('T')[0];
  return formattedDate;
};

export async function startBulkVariantMetricsOperation(
  graphql: AdminGraphqlClient,
) {
  const minCreatedAt = getOneYearBefore();
  const response = await graphql(
    `#graphql
    mutation createBulkOperation {
      bulkOperationRunQuery(
        query: """
        {
          products(query: "status:ACTIVE") {
            edges {
              node {
                id
                createdAt
                hasOnlyDefaultVariant
                status
                variants {
                  edges {
                    node {
                      id
                      createdAt
                      inventoryQuantity
                      inventoryItem {
                        tracked
                      }
                    }
                  }
                }
              }
            }
          }
          orders(first: 10000, reverse: true, query: "created_at:>=${minCreatedAt} status:closed") {
            edges {
              node {
                id
                createdAt
                lineItems {
                  edges {
                    node {
                      id
                      quantity
                      variant {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `);

  const { data } = await response.json();
  if (data.bulkOperationRunQuery.userErrors.length > 0) {
    throw new Error(data.bulkOperationRunQuery.userErrors[0].message);
  }
  return data.bulkOperationRunQuery.bulkOperation.id;
}

export async function getBulkOperationUrl(
  graphql: AdminGraphqlClient,
  operationId: string,
): Promise<string | null> {
  console.log(`Getting bulk operation Url for ID: ${operationId}`);
  const response = await graphql(
    `#graphql
    query getBulkOperationUrl($id: ID!) {
      node(id: $id) {
        ... on BulkOperation {
          url
          status
          errorCode
        }
      }
    }`,
    {
      variables: { id: operationId },
    },
  );

  const { data } = await response.json();
  console.log(`Bulk operation URL response, status: ${data.node.status}, error: ${data.node.errorCode}, URL: ${data.node.url}`);
  if (data.node.status === "FAILED") {
    throw new Error(`Bulk operation failed: ${data.node.errorCode}`);
  }
  return data.node.url;
}

export async function processBulkOperationResult(
  url: string,
  shop: string,
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch bulk operation result: ${response.status}`);
  }

  const text = await response.text();

  const variantMetrics = new Map<string, {
    variantCreatedAt: Date;
    lastOrderDate: Date | null;
    totalSold: number;
    inventoryQuantity: number;
    tracked: boolean;
  }>();

  let currentOrderDate: Date | null = null;
  let processedLines = 0;
  const BATCH_SIZE = 1000;

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line) {
      processLine(line);
    }
  }

  // Process remaining variants
  if (variantMetrics.size > 0) {
    await processBatch(variantMetrics, shop);
  }

  await publish(shop, { premium: true });

  function processLine(line: string) {
    try {
      const data = JSON.parse(line);

      if (typeof data !== 'object' || data === null) {
        console.warn('Skipping invalid JSON object:', line);
        return;
      }

      if (data.__parentId?.includes('/Product/')) {
        // Process variant data
        if (data.inventoryItem?.tracked) {
          variantMetrics.set(data.id, {
            variantCreatedAt: new Date(data.createdAt),
            lastOrderDate: null,
            totalSold: 0,
            inventoryQuantity: data.inventoryQuantity,
            tracked: data.inventoryItem.tracked,
          });
        }
      } else if (data.id?.includes('/Order/')) {
        // Store current order date for subsequent line items
        currentOrderDate = new Date(data.createdAt);
      } else if (data.id?.includes('/LineItem/') && currentOrderDate && data.variant?.id) {
        // Process line item
        const variantId = data.variant.id;
        const variantData = variantMetrics.get(variantId);
        if (!variantData) return;

        // Update last order date
        if (!variantData.lastOrderDate || currentOrderDate > variantData.lastOrderDate) {
          variantData.lastOrderDate = currentOrderDate;
        }

        variantData.totalSold += data.quantity;

        processedLines++;

        // Process in batches to avoid memory buildup
        if (processedLines % BATCH_SIZE === 0) {
          processBatch(variantMetrics, shop).catch(error => {
            console.error('Error processing batch:', error);
          });
          variantMetrics.clear();
        }
      }
    } catch (error) {
      console.warn('Error processing line:', line, error);
    }
  }
}

// Helper function to process a batch of variants
async function processBatch(
  variantMetrics: Map<string, {
    variantCreatedAt: Date;
    lastOrderDate: Date | null;
    totalSold: number;
    inventoryQuantity: number;
    tracked: boolean;
  }>,
  shop: string,
): Promise<void> {
  const metrics = Array.from(variantMetrics.entries())
    .filter(([_, data]) => data.tracked)
    .map(([variantId, data]) => {
      return {
        variantId,
        variantCreatedAt: data.variantCreatedAt,
        lastOrderDate: data.lastOrderDate,
        totalSold: data.totalSold,
        inventoryQuantity: data.inventoryQuantity
      };
    });

  await deleteMetrics(shop);

  // Process metrics in smaller chunks for database operations
  const DB_BATCH_SIZE = 100;
  for (let i = 0; i < metrics.length; i += DB_BATCH_SIZE) {
    const batch = metrics.slice(i, i + DB_BATCH_SIZE);
    await Promise.all(
      batch.map(metric => calculateAndStoreVariantMetrics(shop, metric))
    );
  }
}

export function deleteMetrics(shop: string) {
  return db.variantMetric.deleteMany({ where: { shop } });
}

export function deleteVariant(graphql: AdminGraphqlClient, productId: string, variantId: string) {
  return graphql(
    `#graphql
      mutation ProductVariantsDelete($productId: ID!, $variantsIds: [ID!]!) {
        productVariantsBulkDelete(productId: $productId, variantsIds: $variantsIds) {
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
        variantsIds: [
          variantId,
        ],
      },
    },
  );
}
