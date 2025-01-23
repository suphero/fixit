import type { ActionFunctionArgs } from "@remix-run/node";
import { isAuthorized, unauthorizedResponse } from "../utils/auth.server";
import { getAllSessions } from "../models/session.business.server";
import { unauthenticated } from "../shopify.server";
import { initializeAll } from "../models/recommendation.business.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  const sessions = await getAllSessions();
  for (const session of sessions) {
    const { admin } = await unauthenticated.admin(session.shop);
    await initializeAll(admin.graphql, session.shop);
  }

  return new Response(null, { status: 200 });
};
