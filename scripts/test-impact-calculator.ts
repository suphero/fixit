/**
 * Impact Calculator Unit Tests
 *
 * Tests all recommendation types and their impact calculations
 * Usage: npx tsx scripts/test-impact-calculator.ts
 */

import {
  calculateImpact,
  calculatePricingImpact,
  calculateTextImpact,
  calculateMediaImpact,
  calculateStockImpact,
} from '../app/utils/impact-calculator.server';

// Mock settings
const mockSettings = {
  id: 'test-id',
  shop: 'test-shop',
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assertEquals(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`  ✅ ${testName}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual: ${actual}`);
    testsFailed++;
  }
}

function assertInRange(actual: number, min: number, max: number, testName: string) {
  if (actual >= min && actual <= max) {
    console.log(`  ✅ ${testName} (${actual})`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Expected: ${min}-${max}`);
    console.log(`     Actual: ${actual}`);
    testsFailed++;
  }
}

function assertGreaterThan(actual: number, min: number, testName: string) {
  if (actual > min) {
    console.log(`  ✅ ${testName} (${actual.toFixed(2)})`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${testName}`);
    console.log(`     Expected: > ${min}`);
    console.log(`     Actual: ${actual}`);
    testsFailed++;
  }
}

console.log('\n🧪 Testing Impact Calculator\n');

// ============================================================================
// PRICING TESTS
// ============================================================================
console.log('📊 PRICING IMPACT TESTS\n');

// Test 1: SALE_AT_LOSS (Critical)
console.log('1. Sale at Loss (Critical Impact)');
const saleAtLoss = calculatePricingImpact(
  'SALE_AT_LOSS',
  { price: 10, cost: 15, averageDailySales: 2 },
  mockSettings
);
assertEquals(saleAtLoss.impactScore, 95, 'Impact score should be 95 (critical)');
assertEquals(saleAtLoss.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(saleAtLoss.potentialRevenue, 0, 'Should have revenue recovery');
assertEquals(saleAtLoss.impactMetadata.confidence, 'high', 'Should have high confidence');
console.log(`   Monthly loss recovery: $${saleAtLoss.potentialRevenue.toFixed(2)}\n`);

// Test 2: FREE Product
console.log('2. Free Product (Very High Impact)');
const freeProduct = calculatePricingImpact(
  'FREE',
  { price: 0, cost: 5, averageDailySales: 1 },
  mockSettings
);
assertEquals(freeProduct.impactScore, 90, 'Impact score should be 90');
assertEquals(freeProduct.impactType, 'positive', 'Should be positive impact');
assertGreaterThan(freeProduct.potentialRevenue, 0, 'Should have potential revenue');
console.log(`   Potential monthly revenue: $${freeProduct.potentialRevenue.toFixed(2)}\n`);

// Test 3: CHEAP Product (Low margin)
console.log('3. Cheap Product (Low Margin)');
const cheapProduct = calculatePricingImpact(
  'CHEAP',
  { price: 10.5, cost: 10, averageDailySales: 5 },
  mockSettings
);
assertEquals(cheapProduct.impactScore, 70, 'Impact score should be 70');
assertEquals(cheapProduct.impactType, 'positive', 'Should be positive impact');
assertGreaterThan(cheapProduct.potentialRevenue, 0, 'Should have revenue opportunity');
console.log(`   Additional monthly revenue: $${cheapProduct.potentialRevenue.toFixed(2)}\n`);

// Test 4: EXPENSIVE Product
console.log('4. Expensive Product (Overpriced)');
const expensiveProduct = calculatePricingImpact(
  'EXPENSIVE',
  { price: 25, cost: 10, averageDailySales: 3 },
  mockSettings
);
assertEquals(expensiveProduct.impactScore, 60, 'Impact score should be 60');
assertEquals(expensiveProduct.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(expensiveProduct.potentialRevenue, 0, 'Should show potential sales loss');
console.log(`   Potential sales loss: $${expensiveProduct.potentialRevenue.toFixed(2)}\n`);

// Test 5: HIGH_DISCOUNT
console.log('5. High Discount (Excessive)');
const highDiscount = calculatePricingImpact(
  'HIGH_DISCOUNT',
  { price: 20, compareAtPrice: 100, averageDailySales: 2 },
  mockSettings
);
assertEquals(highDiscount.impactScore, 75, 'Impact score should be 75');
assertEquals(highDiscount.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(highDiscount.potentialRevenue, 0, 'Should show margin loss');
console.log(`   Monthly margin loss: $${highDiscount.potentialRevenue.toFixed(2)}\n`);

// Test 6: LOW_DISCOUNT
console.log('6. Low Discount');
const lowDiscount = calculatePricingImpact(
  'LOW_DISCOUNT',
  { price: 97, compareAtPrice: 100, averageDailySales: 1 },
  mockSettings
);
assertEquals(lowDiscount.impactScore, 40, 'Impact score should be 40');
assertEquals(lowDiscount.impactType, 'positive', 'Should be positive impact');
console.log(`   Potential monthly increase: $${lowDiscount.potentialRevenue.toFixed(2)}\n`);

// Test 7: NO_COST
console.log('7. No Cost Data');
const noCost = calculatePricingImpact(
  'NO_COST',
  { price: 50, cost: 0, averageDailySales: 1 },
  mockSettings
);
assertEquals(noCost.impactScore, 30, 'Impact score should be 30');
assertEquals(noCost.impactType, 'neutral', 'Should be neutral impact');
assertEquals(noCost.potentialRevenue, 0, 'Should have no revenue calculation');
console.log(`   Cannot calculate without cost data\n`);

// ============================================================================
// TEXT IMPACT TESTS
// ============================================================================
console.log('📝 TEXT/SEO IMPACT TESTS\n');

// Test 8: SHORT_TITLE
console.log('8. Short Title (Poor SEO)');
const shortTitle = calculateTextImpact(
  'SHORT_TITLE',
  { price: 30, averageDailySales: 2, title: 'Hat' }
);
assertEquals(shortTitle.impactScore, 55, 'Impact score should be 55');
assertEquals(shortTitle.impactType, 'positive', 'Should be positive impact');
assertGreaterThan(shortTitle.potentialRevenue, 0, 'Should have SEO opportunity');
console.log(`   SEO improvement revenue: $${shortTitle.potentialRevenue.toFixed(2)}\n`);

// Test 9: SHORT_DESCRIPTION
console.log('9. Short Description');
const shortDesc = calculateTextImpact(
  'SHORT_DESCRIPTION',
  { price: 50, averageDailySales: 1.5 }
);
assertEquals(shortDesc.impactScore, 55, 'Impact score should be 55');
assertEquals(shortDesc.impactType, 'positive', 'Should be positive impact');
console.log(`   Content improvement revenue: $${shortDesc.potentialRevenue.toFixed(2)}\n`);

// Test 10: LONG_TITLE
console.log('10. Long Title (Too Verbose)');
const longTitle = calculateTextImpact(
  'LONG_TITLE',
  { price: 40, averageDailySales: 2 }
);
assertEquals(longTitle.impactScore, 45, 'Impact score should be 45');
assertEquals(longTitle.impactType, 'negative', 'Should be negative impact');
console.log(`   Preventing conversion loss: $${longTitle.potentialRevenue.toFixed(2)}\n`);

// ============================================================================
// MEDIA IMPACT TESTS
// ============================================================================
console.log('🖼️  MEDIA IMPACT TESTS\n');

// Test 11: NO_IMAGE (Critical)
console.log('11. No Image (Critical)');
const noImage = calculateMediaImpact(
  'NO_IMAGE',
  { price: 45, averageDailySales: 3 }
);
assertEquals(noImage.impactScore, 100, 'Impact score should be 100 (maximum)');
assertEquals(noImage.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(noImage.potentialRevenue, 100, 'Should have significant revenue loss');
assertEquals(noImage.impactMetadata.confidence, 'high', 'Should have high confidence');
console.log(`   Monthly sales loss: $${noImage.potentialRevenue.toFixed(2)}\n`);

// ============================================================================
// STOCK IMPACT TESTS
// ============================================================================
console.log('📦 STOCK IMPACT TESTS\n');

// Test 12: NO_STOCK
console.log('12. Out of Stock');
const noStock = calculateStockImpact(
  'NO_STOCK',
  { price: 60, averageDailySales: 4, inventoryQuantity: 0 },
  mockSettings
);
assertEquals(noStock.impactScore, 95, 'Impact score should be 95');
assertEquals(noStock.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(noStock.potentialRevenue, 1000, 'Should show significant sales loss');
assertEquals(noStock.impactMetadata.confidence, 'high', 'Should have high confidence');
console.log(`   Monthly sales loss: $${noStock.potentialRevenue.toFixed(2)}\n`);

// Test 13: UNDERSTOCK
console.log('13. Understock (Low Inventory)');
const understock = calculateStockImpact(
  'UNDERSTOCK',
  { price: 35, averageDailySales: 2, inventoryQuantity: 5 },
  mockSettings
);
assertEquals(understock.impactScore, 70, 'Impact score should be 70');
assertEquals(understock.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(understock.potentialRevenue, 0, 'Should show stockout risk');
console.log(`   Risk of stockout loss: $${understock.potentialRevenue.toFixed(2)}\n`);

// Test 14: OVERSTOCK
console.log('14. Overstock (Excess Inventory)');
const overstock = calculateStockImpact(
  'OVERSTOCK',
  { price: 25, cost: 15, averageDailySales: 1, inventoryQuantity: 200 },
  mockSettings
);
assertEquals(overstock.impactScore, 50, 'Impact score should be 50');
assertEquals(overstock.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(overstock.potentialRevenue, 0, 'Should show capital tied up');
console.log(`   Opportunity cost: $${overstock.potentialRevenue.toFixed(2)}\n`);

// Test 15: PASSIVE (Inactive)
console.log('15. Passive Product (No Sales)');
const passive = calculateStockImpact(
  'PASSIVE',
  { price: 20, cost: 12, averageDailySales: 0, inventoryQuantity: 50 },
  mockSettings
);
assertEquals(passive.impactScore, 60, 'Impact score should be 60');
assertEquals(passive.impactType, 'negative', 'Should be negative impact');
assertGreaterThan(passive.potentialRevenue, 0, 'Should show dead inventory cost');
console.log(`   Dead inventory cost: $${passive.potentialRevenue.toFixed(2)}\n`);

// ============================================================================
// INTEGRATION TESTS (Main calculateImpact function)
// ============================================================================
console.log('🔄 INTEGRATION TESTS\n');

// Test 16: Full calculation for PRICING type
console.log('16. Full Calculation - PRICING/CHEAP');
const fullPricing = calculateImpact(
  'PRICING',
  'CHEAP',
  { price: 11, cost: 10, averageDailySales: 3 },
  mockSettings
);
assertEquals(fullPricing.impactScore, 70, 'Should return correct impact score');
assertEquals(fullPricing.impactType, 'positive', 'Should return correct impact type');
console.log(`   Revenue opportunity: $${fullPricing.potentialRevenue.toFixed(2)}\n`);

// Test 17: Full calculation for MEDIA type
console.log('17. Full Calculation - MEDIA/NO_IMAGE');
const fullMedia = calculateImpact(
  'MEDIA',
  'NO_IMAGE',
  { price: 50, averageDailySales: 2 },
  mockSettings
);
assertEquals(fullMedia.impactScore, 100, 'Should return maximum impact');
assertEquals(fullMedia.impactType, 'negative', 'Should be negative');
console.log(`   Sales loss: $${fullMedia.potentialRevenue.toFixed(2)}\n`);

// Test 18: Edge case - Zero daily sales
console.log('18. Edge Case - Zero Daily Sales');
const zeroSales = calculateImpact(
  'PRICING',
  'CHEAP',
  { price: 15, cost: 10, averageDailySales: 0 },
  mockSettings
);
assertInRange(zeroSales.potentialRevenue, 0, 100, 'Should handle zero sales gracefully');
console.log(`   Revenue with zero sales: $${zeroSales.potentialRevenue.toFixed(2)}\n`);

// Test 19: Edge case - Very high sales volume
console.log('19. Edge Case - High Sales Volume');
const highSales = calculateImpact(
  'STOCK',
  'NO_STOCK',
  { price: 100, averageDailySales: 50, inventoryQuantity: 0 },
  mockSettings
);
assertGreaterThan(highSales.potentialRevenue, 10000, 'Should calculate large revenue loss');
console.log(`   Massive sales loss: $${highSales.potentialRevenue.toFixed(2)}\n`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('═'.repeat(60));
console.log('\n📊 TEST SUMMARY\n');
console.log(`   Total Tests: ${testsPassed + testsFailed}`);
console.log(`   ✅ Passed: ${testsPassed}`);
console.log(`   ❌ Failed: ${testsFailed}`);
console.log(`   Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`);

if (testsFailed === 0) {
  console.log('🎉 All tests passed! Impact Calculator is working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the output above.\n');
  process.exit(1);
}
