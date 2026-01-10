import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.business.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, redirect } = await authenticate.admin(request);
  const shop = await getShop(session.shop);

  // Redirect to welcome screen if onboarding is not completed
  if (!shop.onboardingCompleted) {
    return redirect("/app/welcome");
  }

  return redirect("/app/reco");
};
