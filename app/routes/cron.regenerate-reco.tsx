import type { ActionFunctionArgs } from "@remix-run/node";
import { isAuthorized, unauthorizedResponse } from "../utils/auth.server";
import { publish } from "../queues/generate-reco.server";
import { getAllSessions } from "../models/session.business.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!isAuthorized(request)) {
    return unauthorizedResponse();
  }

  const sessions = await getAllSessions();
  for (const session of sessions) {
    await publish(session.shop);
  }

  return new Response(null, { status: 200 });
};
