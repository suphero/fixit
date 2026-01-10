import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";

// SECURITY: This endpoint should only be used for debugging
// In production, you should add authentication or remove this route

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "Shop parameter is required" }, { status: 400 });
  }

  try {
    console.log(`[debug.check-session] Checking sessions for shop: ${shop}`);

    // Get all sessions for this shop
    const sessions = await prisma.session.findMany({
      where: { shop },
      select: {
        id: true,
        shop: true,
        scope: true,
        isOnline: true,
        expires: true,
        userId: true,
      }
    });

    console.log(`[debug.check-session] Found ${sessions.length} sessions`);

    return json({
      shop,
      sessionCount: sessions.length,
      sessions: sessions.map(s => ({
        ...s,
        expires: s.expires?.toISOString(),
        isExpired: s.expires ? s.expires < new Date() : false
      }))
    });
  } catch (error) {
    console.error("[debug.check-session] Error:", error);
    return json({
      error: "Failed to check sessions",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
