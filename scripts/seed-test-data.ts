/**
 * Test Data Seeder for Impact Score Testing (with productSnapshot)
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

  // 3. Create Test Recommendations (with productSnapshot for impact calculation)
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
      productSnapshot: {
        title: 'Red T-Shirt',
        description: 'Comfortable cotton t-shirt',
        price: 10,
        cost: 15, // Selling at loss!
        compareAtPrice: 0,
        inventoryQuantity: 50,
        averageDailySales: 2,
      },
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
      productSnapshot: {
        title: 'Blue Mug',
        description: 'Ceramic mug',
        price: 0, // Free!
        cost: 5,
        compareAtPrice: 0,
        inventoryQuantity: 100,
        averageDailySales: 1,
      },
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
      productSnapshot: {
        title: 'Coffee Beans',
        description: 'Premium arabica beans',
        price: 10.5,
        cost: 10,
        compareAtPrice: 0,
        inventoryQuantity: 200,
        averageDailySales: 5,
      },
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
      productSnapshot: {
        title: 'Winter Jacket',
        description: 'Warm winter jacket',
        price: 20,
        cost: 15,
        compareAtPrice: 100, // 80% discount!
        inventoryQuantity: 30,
        averageDailySales: 2,
      },
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
      productSnapshot: {
        title: 'Hat',
        description: 'A comfortable hat',
        price: 30,
        cost: 15,
        compareAtPrice: 0,
        inventoryQuantity: 75,
        averageDailySales: 2,
      },
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
      productSnapshot: {
        title: 'Premium Leather Wallet',
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. More text here to make it very long description.',
        price: 50,
        cost: 25,
        compareAtPrice: 0,
        inventoryQuantity: 40,
        averageDailySales: 1.5,
      },
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
      productSnapshot: {
        title: 'Sunglasses Classic',
        description: 'Classic sunglasses design',
        price: 45,
        cost: 20,
        compareAtPrice: 0,
        inventoryQuantity: 60,
        averageDailySales: 3,
      },
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
      productSnapshot: {
        title: 'Running Shoes',
        description: 'Professional running shoes',
        price: 60,
        cost: 30,
        compareAtPrice: 0,
        inventoryQuantity: 0, // Out of stock!
        averageDailySales: 4,
      },
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
      productSnapshot: {
        title: 'Wireless Headphones',
        description: 'Noise-cancelling headphones',
        price: 35,
        cost: 20,
        compareAtPrice: 0,
        inventoryQuantity: 5, // Low stock!
        averageDailySales: 2,
      },
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
      productSnapshot: {
        title: 'Old Model Phone Case',
        description: 'Phone case for old model',
        price: 20,
        cost: 12,
        compareAtPrice: 0,
        inventoryQuantity: 50,
        averageDailySales: 0.01, // Almost no sales
      },
    },
  ];

  await prisma.recommendation.deleteMany({ where: { shop: shopDomain } });
  await prisma.recommendation.createMany({ data: recommendations as any });
  console.log(`✅ Created ${recommendations.length} test recommendations (with productSnapshot)`);

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
  console.log(`   Recommendations: ${recommendations.length} (all with productSnapshot)`);
  console.log(`   - PRICING: ${recommendations.filter(r => r.type === 'PRICING').length}`);
  console.log(`   - TEXT: ${recommendations.filter(r => r.type === 'TEXT').length}`);
  console.log(`   - MEDIA: ${recommendations.filter(r => r.type === 'MEDIA').length}`);
  console.log(`   - STOCK: ${recommendations.filter(r => r.type === 'STOCK').length}`);
  console.log(`   - Premium: ${recommendations.filter(r => r.premium).length}`);
  console.log(`   - Free: ${recommendations.filter(r => !r.premium).length}`);
  console.log(`\n✨ All recommendations now have productSnapshot for offline impact calculation!`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
