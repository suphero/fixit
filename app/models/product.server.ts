import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";

export function updateTitle(
  graphql: AdminGraphqlClient,
  id: string,
  title: string,
) {
  return graphql(
    `#graphql
    mutation ProductUpdate($input: ProductUpdateInput!) {
      productUpdate(product: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          id,
          title,
        },
      },
    },
  );
}

export function archive(graphql: AdminGraphqlClient, id: string) {
  return graphql(
    `#graphql
    mutation productUpdate($input: ProductUpdateInput!) {
      productUpdate(product: $input) {
        product {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: {
          id,
          status: "ARCHIVED",
        },
      },
    },
  );
}

export async function updateDescription(
  graphql: AdminGraphqlClient,
  id: string,
  descriptionHtml: string,
) {
  return graphql(
    `#graphql
      mutation productUpdate($input: ProductUpdateInput!) {
        productUpdate(product: $input) {
          product {
            id
            descriptionHtml
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
        input: {
          id,
          descriptionHtml,
        },
      },
    },
  );
}

export async function fetch(
  graphql: AdminGraphqlClient,
  cursor: string | null,
) {
  const response = await graphql(
    `#graphql
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
    }`,
    { variables: { cursor } },
  );
  const { data } = await response.json();
  return data.products;
}
