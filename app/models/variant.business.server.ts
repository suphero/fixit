import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";
import db from "../db.server";
import { publish } from "app/consumers/generate-reco.server";

interface BulkSalesMetrics {
  variantId: string;
  firstOrderDate: Date | null;
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

export async function isVariantDefault(
  graphql: AdminGraphqlClient,
  variantId: string,
): Promise<boolean> {
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

async function calculateAndStoreSalesMetrics(
  shop: string,
  metrics: {
    variantId: string;
    firstOrderDate: Date | null;
    lastOrderDate: Date | null;
    totalSold: number;
  },
) {
  const { variantId, firstOrderDate, lastOrderDate, totalSold } = metrics;

  if (!firstOrderDate || !lastOrderDate) {
    return db.variantSalesMetrics.upsert({
      where: { shop_variantId: { shop, variantId } },
      create: {
        shop,
        variantId,
        totalSold,
        averageDailySales: 0,
      },
      update: {
        totalSold,
        averageDailySales: 0,
      },
    });
  }

  const daysBetween = Math.max(
    1,
    (new Date(lastOrderDate).getTime() - new Date(firstOrderDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const averageDailySales = totalSold / daysBetween;

  return db.variantSalesMetrics.upsert({
    where: { shop_variantId: { shop, variantId } },
    create: {
      shop,
      variantId,
      firstOrderDate: new Date(firstOrderDate),
      lastOrderDate: new Date(lastOrderDate),
      totalSold,
      averageDailySales,
    },
    update: {
      firstOrderDate: new Date(firstOrderDate),
      lastOrderDate: new Date(lastOrderDate),
      totalSold,
      averageDailySales,
    },
  });
}

export async function getSalesMetrics(
  shop: string,
  variantId: string,
): Promise<BulkSalesMetrics | null> {
  const data = await db.variantSalesMetrics.findUnique({
    where: { shop_variantId: { shop, variantId } },
  });

  if (!data) return null;

  return {
    variantId: data.variantId,
    firstOrderDate: data.firstOrderDate,
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
  },
): "PASSIVE" | "UNDERSTOCK" | "OVERSTOCK" | null {
  const now = new Date();

  // Check for passive products
  if (metrics.lastOrderDate) {
    const daysSinceLastOrder = Math.floor(
      (now.getTime() - metrics.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysSinceLastOrder > settings.passiveDays) {
      return "PASSIVE";
    }
  }

  // Skip if no sales history
  if (metrics.averageDailySales === 0) {
    return null;
  }

  // Calculate stock status
  const daysOfStock = metrics.inventoryQuantity / metrics.averageDailySales;

  if (daysOfStock < settings.understockDays) {
    return "UNDERSTOCK";
  }

  if (daysOfStock > settings.overstockDays) {
    return "OVERSTOCK";
  }

  return null;
}

export async function startBulkSalesMetricsOperation(
  graphql: AdminGraphqlClient,
) {
  const response = await graphql(
    `#graphql
    mutation createBulkOperation {
      bulkOperationRunQuery(
        query: """
        {
          orders(sortKey: CREATED_AT) {
            edges {
              node {
                id
                createdAt
                lineItems {
                  edges {
                    node {
                      quantity
                      variant {
                        id
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

interface BulkOperationLine {
  id: string;
  createdAt: string;
  lineItems: {
    edges: Array<{
      node: {
        quantity: number;
        variant: {
          id: string;
          inventoryQuantity: number;
          inventoryItem: {
            tracked: boolean;
          };
        };
      };
    }>;
  };
}

export async function processBulkOperationResult(
  url: string,
  shop: string,
): Promise<void> {
  console.log(`Processing bulk operation result for shop: ${shop} with URL: ${url}`);
  const response = await fetch(url);
  const text = await response.text();
  const lines = text.trim().split("\n");

  // First, collect all orders data
  const variantSales = new Map<
    string,
    {
      firstOrderDate: Date | null;
      lastOrderDate: Date | null;
      totalSold: number;
      inventoryQuantity: number;
      tracked: boolean;
    }
  >();

  console.log(`Processing ${lines.length} orders for shop: ${shop}...`);

  // Process each order
  lines.forEach((line) => {
    const order = JSON.parse(line) as BulkOperationLine;
    const orderDate = new Date(order.createdAt);

    // Process each line item
    order.lineItems.edges.forEach(({ node }) => {
      const { variant, quantity } = node;
      if (!variant) return;

      const existing = variantSales.get(variant.id) || {
        firstOrderDate: null,
        lastOrderDate: null,
        totalSold: 0,
        inventoryQuantity: variant.inventoryQuantity,
        tracked: variant.inventoryItem?.tracked || false,
      };

      // Update sales data
      if (!existing.firstOrderDate || orderDate < existing.firstOrderDate) {
        existing.firstOrderDate = orderDate;
      }
      if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
        existing.lastOrderDate = orderDate;
      }
      existing.totalSold += quantity;

      variantSales.set(variant.id, existing);
    });
  });

  // Convert to metrics and filter untracked variants
  const metrics = Array.from(variantSales.entries())
    .filter(([_, data]) => data.tracked)
    .map(([variantId, data]) => ({
      variantId,
      firstOrderDate: data.firstOrderDate,
      lastOrderDate: data.lastOrderDate,
      totalSold: data.totalSold,
      inventoryQuantity: data.inventoryQuantity,
    }));

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    await Promise.all(
      batch.map((metric) => calculateAndStoreSalesMetrics(shop, metric)),
    );
  }

  await publish(shop, { premium: true });
}

export function deleteMetrics(shop: string) {
  return db.variantSalesMetrics.deleteMany({ where: { shop } });
}
