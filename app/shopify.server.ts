import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { LoggingSessionStorage } from "./session-storage.server";
import { createShop } from "./models/shop.business.server";
import { createSettings } from "./models/settings.business.server";
import { initializeAll } from "./models/recommendation.business.server";

console.log('[shopify.server] Initializing Shopify App with:', {
  apiKey: process.env.SHOPIFY_API_KEY,
  hasApiSecret: !!process.env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL,
  distribution: AppDistribution.AppStore,
});

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET ?? "",
  apiVersion: ApiVersion.October24,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL ?? "",
  authPathPrefix: "/auth",
  hooks: {
    afterAuth: async ({ session, admin }) => {
      console.log('[shopify.server] afterAuth hook called for shop:', session.shop);
      try {
        await createShop(session.shop);
        await createSettings(session.shop);
        await initializeAll(admin.graphql, session.shop);
        await registerWebhooks({ session });
        console.log('[shopify.server] afterAuth hook completed successfully');
      } catch (error) {
        console.error('[shopify.server] Error in afterAuth hook:', error);
        throw error;
      }
    },
  },
  sessionStorage: new LoggingSessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    removeRest: true,
  },
  isEmbeddedApp: true,
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

if (!process.env.SHOPIFY_API_SECRET) {
  console.warn("SHOPIFY_API_SECRET is not set. Webhook authentication will fail.");
}

export default shopify;
export const apiVersion = ApiVersion.October24;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
