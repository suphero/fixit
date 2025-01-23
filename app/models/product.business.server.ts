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
    status?: string;
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
    query += ` id:${params.productId}`;
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
) {
  const stagedUploadsResponse = await graphql(
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
        userErrors {
          field
          message
        }
      }
    }`,
    {
      variables: {
        input: [{
          filename: image.name,
          mimeType: image.type,
          httpMethod: "POST",
          resource: "PRODUCT_IMAGE"
        }]
      }
    }
  );

  const { data } = await stagedUploadsResponse.json();
  const [{ url, parameters }] = data.stagedUploadsCreate.stagedTargets;

  const formData = new FormData();
  parameters.forEach(({ name, value }: { name: string; value: string }) => {
    formData.append(name, value);
  });
  formData.append('file', image);

  const uploadResponse = await fetch(url, {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error(`Image upload failed with status: ${uploadResponse.status}`);
  }

  const responseText = await uploadResponse.text();
  const locationRegex = /<Location>(.*?)<\/Location>/;
  const locationMatch = locationRegex.exec(responseText);
  const imageUrl = locationMatch ? locationMatch[1] : null;

  if (!imageUrl) {
    throw new Error('Failed to get image URL from upload response');
  }

  const updateProductResponse = await graphql(
    `#graphql
      mutation UpdateProductWithNewMedia(
        $product: ProductUpdateInput!
        $media: [CreateMediaInput!]
      ) {
        productUpdate(product: $product, media: $media) {
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        product: {
          id,
        },
        media: [
          {
            originalSource: imageUrl,
            mediaContentType: "IMAGE",
          }
        ],
      },
    },
  );

  const updateProductData = await updateProductResponse.json();
  return updateProductData;
}

