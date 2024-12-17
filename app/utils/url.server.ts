// Server-side URL utilities
export function getProductUrlFromGid(gid: string) {
  const id = gid.split('/').pop();
  return `/products/${id}`;
}

export function getProductVariantUrlFromGid(productGid: string, variantGid: string) {
  const productId = productGid.split('/').pop();
  const variantId = variantGid.split('/').pop();
  return `/products/${productId}/variants/${variantId}`;
}
