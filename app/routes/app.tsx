import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    console.log('[app.tsx] Starting authentication for URL:', request.url);
    console.log('[app.tsx] Request headers:', {
      host: request.headers.get('host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
    });
    console.log('[app.tsx] URL search params:', {
      shop: url.searchParams.get('shop'),
      host: url.searchParams.get('host'),
      embedded: url.searchParams.get('embedded'),
      hasIdToken: !!url.searchParams.get('id_token'),
    });
    const result = await authenticate.admin(request);
    console.log('[app.tsx] Authentication successful for shop:', result.session.shop);
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    console.error('[app.tsx] Authentication failed with error:', error);
    if (error instanceof Response) {
      console.error('[app.tsx] Error is a Response with status:', error.status);
      console.error('[app.tsx] Response headers:', Object.fromEntries(error.headers.entries()));
    }
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/reco">Recommendations</Link>
        <Link to="/app/settings">Settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
