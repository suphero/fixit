import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "smart-forecast",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    return json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        service: "smart-forecast",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  }
}
