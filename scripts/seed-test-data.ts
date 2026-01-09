/**
 * Test Data Seeder for Impact Score Testing
 *
 * Usage: npx tsx scripts/seed-test-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shopDomain = 'test-shop.myshopify.com';

  console.log('🌱 Seeding test data...');

  // 1. Create Shop
  await prisma.shop.upsert({
    where: { shop: shopDomain },
    update: {},
    create: {
      shop: shopDomain,
      subscriptionName: 'Free',
    },
  });
  console.log('✅ Shop created');

  // 2. Create Settings
  await prisma.settings.upsert({
    where: { shop: shopDomain },
    update: {},
    create: {
      shop: shopDomain,
      minRevenueRate: 10,
      maxRevenueRate: 90,
      lowDiscountRate: 5,
      highDiscountRate: 70,
      shortTitleLength: 20,
      longTitleLength: 70,
      shortDescriptionLength: 80,
      longDescriptionLength: 400,
      understockDays: 7,
      overstockDays: 60,
      passiveDays: 30,
    },
  });
  console.log('✅ Settings created');

  // 3. Create Test Recommendations (various types)
  const recommendations = [
    // PRICING - Sale at Loss (Critical)
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/1',
      variantId: 'gid://shopify/ProductVariant/1',
      targetTitle: 'Red T-Shirt - Size M',
      targetUrl: '/products/1',
      type: 'PRICING',
      subTypes: ['SALE_AT_LOSS'],
      status: 'PENDING',
      premium: false,
    },
    // PRICING - Free Product
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/2',
      variantId: 'gid://shopify/ProductVariant/2',
      targetTitle: 'Blue Mug',
      targetUrl: '/products/2',
      type: 'PRICING',
      subTypes: ['FREE'],
      status: 'PENDING',
      premium: false,
    },
    // PRICING - Cheap Product
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/3',
      variantId: 'gid://shopify/ProductVariant/3',
      targetTitle: 'Coffee Beans - 1kg',
      targetUrl: '/products/3',
      type: 'PRICING',
      subTypes: ['CHEAP'],
      status: 'PENDING',
      premium: false,
    },
    // PRICING - High Discount
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/4',
      variantId: 'gid://shopify/ProductVariant/4',
      targetTitle: 'Winter Jacket - XL',
      targetUrl: '/products/4',
      type: 'PRICING',
      subTypes: ['HIGH_DISCOUNT'],
      status: 'PENDING',
      premium: false,
    },
    // TEXT - Short Title
    {
      shop: shopDomain,
      targetType: 'PRODUCT',
      productId: 'gid://shopify/Product/5',
      variantId: null,
      targetTitle: 'Hat',
      targetUrl: '/products/5',
      type: 'TEXT',
      subTypes: ['SHORT_TITLE'],
      status: 'PENDING',
      premium: false,
    },
    // TEXT - Long Description
    {
      shop: shopDomain,
      targetType: 'PRODUCT',
      productId: 'gid://shopify/Product/6',
      variantId: null,
      targetTitle: 'Premium Leather Wallet',
      targetUrl: '/products/6',
      type: 'TEXT',
      subTypes: ['LONG_DESCRIPTION'],
      status: 'PENDING',
      premium: false,
    },
    // MEDIA - No Image (Critical)
    {
      shop: shopDomain,
      targetType: 'PRODUCT',
      productId: 'gid://shopify/Product/7',
      variantId: null,
      targetTitle: 'Sunglasses Classic',
      targetUrl: '/products/7',
      type: 'MEDIA',
      subTypes: ['NO_IMAGE'],
      status: 'PENDING',
      premium: false,
    },
    // STOCK - Out of Stock (Premium)
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/8',
      variantId: 'gid://shopify/ProductVariant/8',
      targetTitle: 'Running Shoes - Size 42',
      targetUrl: '/products/8',
      type: 'STOCK',
      subTypes: ['NO_STOCK'],
      status: 'PENDING',
      premium: false,
    },
    // STOCK - Understock (Premium)
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/9',
      variantId: 'gid://shopify/ProductVariant/9',
      targetTitle: 'Wireless Headphones',
      targetUrl: '/products/9',
      type: 'STOCK',
      subTypes: ['UNDERSTOCK'],
      status: 'PENDING',
      premium: true,
    },
    // STOCK - Passive (Premium)
    {
      shop: shopDomain,
      targetType: 'PRODUCT_VARIANT',
      productId: 'gid://shopify/Product/10',
      variantId: 'gid://shopify/ProductVariant/10',
      targetTitle: 'Old Model Phone Case',
      targetUrl: '/products/10',
      type: 'STOCK',
      subTypes: ['PASSIVE'],
      status: 'PENDING',
      premium: true,
    },
  ];

  await prisma.recommendation.deleteMany({ where: { shop: shopDomain } });
  await prisma.recommendation.createMany({ data: recommendations as any });
  console.log(`✅ Created ${recommendations.length} test recommendations`);

  // 4. Create Variant Metrics for stock recommendations
  const metrics = [
    {
      shop: shopDomain,
      variantId: 'gid://shopify/ProductVariant/8',
      variantCreatedAt: new Date('2024-01-01'),
      lastOrderDate: new Date('2024-12-01'),
      totalSold: 150,
      averageDailySales: 2.5,
    },
    {
      shop: shopDomain,
      variantId: 'gid://shopify/ProductVariant/9',
      variantCreatedAt: new Date('2024-06-01'),
      lastOrderDate: new Date('2026-01-05'),
      totalSold: 80,
      averageDailySales: 1.2,
    },
    {
      shop: shopDomain,
      variantId: 'gid://shopify/ProductVariant/10',
      variantCreatedAt: new Date('2023-01-01'),
      lastOrderDate: new Date('2025-10-15'),
      totalSold: 5,
      averageDailySales: 0.01,
    },
  ];

  for (const metric of metrics) {
    await prisma.variantMetric.upsert({
      where: {
        shop_variantId: {
          shop: metric.shop,
          variantId: metric.variantId,
        },
      },
      update: metric,
      create: metric,
    });
  }
  console.log(`✅ Created ${metrics.length} variant metrics`);

  console.log('\n🎉 Test data seeded successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`   Shop: ${shopDomain}`);
  console.log(`   Recommendations: ${recommendations.length}`);
  console.log(`   - PRICING: ${recommendations.filter(r => r.type === 'PRICING').length}`);
  console.log(`   - TEXT: ${recommendations.filter(r => r.type === 'TEXT').length}`);
  console.log(`   - MEDIA: ${recommendations.filter(r => r.type === 'MEDIA').length}`);
  console.log(`   - STOCK: ${recommendations.filter(r => r.type === 'STOCK').length}`);
  console.log(`   - Premium: ${recommendations.filter(r => r.premium).length}`);
  console.log(`   - Free: ${recommendations.filter(r => !r.premium).length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
