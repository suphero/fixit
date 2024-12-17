// Client-side URL utilities
export function getShopifyAdminUrl(shop: string, targetUrl: string) {
  // Extract shop name from the domain (e.g., "smart-forecast-demo" from "smart-forecast-demo.myshopify.com")
  const shopName = shop.split('.')[0];
  return `https://admin.shopify.com/store/${shopName}${targetUrl}`;
}
