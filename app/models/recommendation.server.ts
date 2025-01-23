import type { RecommendationStatus , RecommendationType } from "@prisma/client";
import { authenticate } from "../shopify.server";
import * as business from "./recommendation.business.server";

export async function getRecommendationsByType(
  request: Request,
  type: RecommendationType,
  status: RecommendationStatus,
  page: number,
  size: number,
) {
  const { session } = await authenticate.admin(request);
  return business.getRecommendationsByType(session.shop, type, status, page, size);
}

export async function getRecommendationCounts(
  request: Request,
  status: RecommendationStatus,
): Promise<Record<RecommendationType, business.RecommendationCount>> {
  const { session } = await authenticate.admin(request);
  return business.getRecommendationCounts(session.shop, status);
}

export async function initializeAll(request: Request) {
  const { session, admin } = await authenticate.admin(request);
  await business.initializeAll(admin.graphql, session.shop);
}

export async function updatePricing(
  request: Request,
  data: {
    id: string;
    cost?: string;
    price?: string;
    compareAtPrice?: string;
  },
) {
  const { admin, session } = await authenticate.admin(request);
  return business.updatePricing(admin.graphql, session.shop, data);
}

export async function updateText(
  request: Request,
  data: {
    id: string;
    title: string;
    descriptionHtml: string;
  },
) {
  const { admin, session } = await authenticate.admin(request);
  return business.updateText(admin.graphql, session.shop, data);
}

export async function updateMedia(
  request: Request,
  data: {
    id: string,
    image: File,
  }
) {
  const { admin, session } = await authenticate.admin(request);
  return business.updateMedia(admin.graphql, session.shop, data);
}

export async function updateStock(
  request: Request,
  data: {
    id: string;
    quantity: number;
  },
) {
  const { admin, session } = await authenticate.admin(request);
  return business.updateStock(admin.graphql, session.shop, data);
}

export async function archiveProduct(
  request: Request,
  id: string,
) {
  const { admin, session } = await authenticate.admin(request);
  return business.archiveProduct(admin.graphql, session.shop, id);
}

export async function deleteVariant(
  request: Request,
  id: string,
) {
  const { admin, session } = await authenticate.admin(request);
  return business.deleteVariant(admin.graphql, session.shop, id);
}
