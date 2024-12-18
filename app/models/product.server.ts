import { authenticate } from "../shopify.server";
import { getShopSettings } from "./settings.server";
import db from "../db.server";

export async function updateTitle(
  request: Request,
  recommendationId: string,
  newTitle: string
) {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getShopSettings(request);

  const recommendation = await db.recommendation.findFirst({
    where: { id: recommendationId, shop: session.shop },
  });

  if (!recommendation) {
    throw new Error('Recommendation not found');
  }

  if (newTitle.length < settings.shortTitleLength) {
    throw new Error(`Title must be at least ${settings.shortTitleLength} characters`);
  }
  if (newTitle.length > settings.longTitleLength) {
    throw new Error(`Title must not exceed ${settings.longTitleLength} characters`);
  }

  await admin.graphql(
    `mutation updateProduct($input: ProductInput!) {
      productUpdate(input: $input) {
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
          id: recommendation.targetId,
          title: newTitle,
        },
      },
    },
  );

  return db.recommendation.update({
    where: { id: recommendationId },
    data: {
      status: 'RESOLVED',
      targetTitle: newTitle,
    },
  });
}
