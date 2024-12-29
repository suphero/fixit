import type { AdminGraphqlClient } from "@shopify/shopify-app-remix/server";

export async function getDetails(graphql: AdminGraphqlClient, id: string) {
  const response = await graphql(
    `#graphql
    query getProduct($id: ID!) {
      product(id: $id) {
        title
        descriptionHtml
      }
    }`,
    {
      variables: { id },
    },
  );

  const { data } = await response.json();
  const title = data.product.title;
  const descriptionHtml = data.product.descriptionHtml;

  return {
    title,
    descriptionHtml,
  };
}

export async function updateProduct(
  graphql: AdminGraphqlClient,
  id: string,
  input: {
    title?: string;
    descriptionHtml?: string;
  }
) {
  return graphql(
    `#graphql
    mutation ProductUpdate($input: ProductUpdateInput!) {
      productUpdate(product: $input) {
        product {
          id
          title
          descriptionHtml
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
          ...input,
        },
      },
    },
  );
}

export async function fetchProduct(
  graphql: AdminGraphqlClient,
  params: { cursor: string | null, productId?: string}
) {
  let query = "status:active";
  if (params.productId) {
    query += ` AND id:${params.productId}`;
  }
  const response = await graphql(
    `#graphql
    query getProducts($cursor: String, $query: String) {
      products(first: 50, after: $cursor, query: $query) {
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
    { variables: { cursor: params.cursor, query } },
  );
  const { data } = await response.json();
  return data.products;
}

export async function updateImage(
  graphql: AdminGraphqlClient,
  id: string,
  image: File
): Promise<void> {
  // First, get a staged upload URL
  const stagedUploadResponse = await graphql(
    `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
      }
    }`,
    {
      variables: {
        input: [{
          filename: image.name,
          mimeType: image.type,
          resource: "PRODUCT_IMAGE"
        }]
      }
    }
  );

  const { data } = await stagedUploadResponse.json();
  const [{ url, parameters }] = data.stagedUploadsCreate.stagedTargets;

  // Create form data for upload
  const formData = new FormData();
  parameters.forEach(({ name, value }: { name: string; value: string }) => {
    formData.append(name, value);
  });
  formData.append('file', image);

  // Upload the file
  await fetch(url, {
    method: 'POST',
    body: formData,
  });

  // Attach the image to the product
  await graphql(
    `#graphql
    mutation productUpdate($input: ProductUpdateInput!) {
      productUpdate(product: $input) {
        product {
          id
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
          images: [{
            src: parameters.find((p: any) => p.name === 'key')?.value
          }]
        }
      }
    }
  );
}
