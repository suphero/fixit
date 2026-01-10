import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";

// SECURITY: This endpoint should only be used for debugging
// In production, you should add authentication or remove this route

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Get shop from request body
    const formData = await request.formData();
    const shop = formData.get("shop") as string;

    if (!shop) {
      return json({ error: "Shop parameter is required" }, { status: 400 });
    }

    console.log(`[debug.clear-sessions] Clearing sessions for shop: ${shop}`);

    // Delete all sessions for this shop
    const result = await prisma.session.deleteMany({
      where: { shop },
    });

    console.log(`[debug.clear-sessions] Deleted ${result.count} sessions`);

    return json({
      success: true,
      message: `Cleared ${result.count} sessions for ${shop}`,
      deletedCount: result.count
    });
  } catch (error) {
    console.error("[debug.clear-sessions] Error:", error);
    return json({
      error: "Failed to clear sessions",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function loader() {
  return json({
    error: "Use POST method with shop parameter to clear sessions"
  }, { status: 405 });
}
