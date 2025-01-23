import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Banner,
  Box,
  InlineGrid,
  Divider,
  Button,
  InlineStack,
} from "@shopify/polaris";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { getShopSettings, updateShopSettings } from "../models/settings.server";
import { getShop } from "../models/shop.server";
import { initializeAll } from "../models/recommendation.server";
import { SHOPIFY_APP_HANDLE } from "../constants/config.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const settings = await getShopSettings(request);
  const shop = await getShop(request);
  const shopId = shop.shop.replace(".myshopify.com", "");
  const planName = shop.subscriptionName;
  const pricingPlanUrl = `https://admin.shopify.com/store/${shopId}/charges/${SHOPIFY_APP_HANDLE}/pricing_plans`;

  return { settings, planName, pricingPlanUrl };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");

  switch (action) {
    case "reinitialize":
      await initializeAll(request);
      return { success: true };
    case "submit": {
      const updates = {
        // Pricing
        minRevenueRate: Number(formData.get("minRevenueRate")),
        maxRevenueRate: Number(formData.get("maxRevenueRate")),
        lowDiscountRate: Number(formData.get("lowDiscountRate")),
        highDiscountRate: Number(formData.get("highDiscountRate")),
        // Text
        shortTitleLength: Number(formData.get("shortTitleLength")),
        longTitleLength: Number(formData.get("longTitleLength")),
        shortDescriptionLength: Number(formData.get("shortDescriptionLength")),
        longDescriptionLength: Number(formData.get("longDescriptionLength")),
        // Inventory
        understockDays: Number(formData.get("understockDays")),
        overstockDays: Number(formData.get("overstockDays")),
        passiveDays: Number(formData.get("passiveDays")),
      };

      await updateShopSettings(request, updates);
      return { success: true };
    }
    default:
      throw new Error(`Invalid action: ${action}`);
  }
}

export default function Settings() {
  const { settings, planName, pricingPlanUrl } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [formValues, setFormValues] = useState(settings);

  const handleSubmit = useCallback(() => {
    fetcher.submit({...formValues, action: 'submit' }, { method: "post" });
  }, [formValues]);

  const handleChange = useCallback((value: string, id: string) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const formatPercent = (value: number) => `${(value).toFixed(0)}%`;

  const calculatePrice = (basePrice: number, rate: number, isDiscount = false) => {
    return isDiscount
      ? basePrice * (1 - rate / 100)  // For discounts: reduce by rate%
      : basePrice * (1 + rate / 100); // For revenue: increase by rate%
  };

  const handleManagePricing = () => {
    window?.top?.location.replace(pricingPlanUrl);
  };

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSubmit,
        loading: fetcher.state === "submitting",
      }}
    >
      <Layout>
        {fetcher.data?.success && (
          <Layout.Section>
            <Banner tone="success">Settings updated successfully</Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">Plan Settings</Text>
                <Text as="p" variant="bodyMd">
                  You are currently on the <Text as="span" fontWeight="bold">{planName}</Text> plan.
                </Text>
              </BlockStack>
              <InlineStack align="end">
                <Button
                  onClick={handleManagePricing}
                  accessibilityLabel="Manage Subscription"
                >
                  Manage Subscription
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Pricing Settings</Text>

              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">Revenue Rate</Text>
                  <Text as="p" tone="subdued">
                    Control profit margins based on product cost
                  </Text>
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Minimum Revenue Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.minRevenueRate)}
                      onChange={(value) => handleChange(value, "minRevenueRate")}
                      autoComplete="off"
                      helpText={`Example: Cost $100 + ${formatPercent(Number(formValues.minRevenueRate))} = Min Price $${calculatePrice(100, formValues.minRevenueRate).toFixed(2)}`}
                      min={0}
                    />
                    <TextField
                      label="Maximum Revenue Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.maxRevenueRate)}
                      onChange={(value) => handleChange(value, "maxRevenueRate")}
                      autoComplete="off"
                      helpText={`Example: Cost $100 + ${formatPercent(Number(formValues.maxRevenueRate))} = Max Price $${calculatePrice(100, formValues.maxRevenueRate).toFixed(2)}`}
                      min={0}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>

              <Divider />

              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">Discount Rate</Text>
                  <Text as="p" tone="subdued">
                    Control discount ranges based on compare-at price
                  </Text>
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Low Discount Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.lowDiscountRate)}
                      onChange={(value) => handleChange(value, "lowDiscountRate")}
                      autoComplete="off"
                      helpText={`Example: Compare $100 - ${formatPercent(Number(formValues.lowDiscountRate))} = Price $${calculatePrice(100, formValues.lowDiscountRate, true).toFixed(2)}`}
                      min={0}
                    />
                    <TextField
                      label="High Discount Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.highDiscountRate)}
                      onChange={(value) => handleChange(value, "highDiscountRate")}
                      autoComplete="off"
                      helpText={`Example: Compare $100 - ${formatPercent(Number(formValues.highDiscountRate))} = Price $${calculatePrice(100, formValues.highDiscountRate, true).toFixed(2)}`}
                      min={0}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Text Settings</Text>

              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">Title Length</Text>
                  <Text as="p" tone="subdued">
                    Control product title length for better SEO
                  </Text>
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Minimum Title Length"
                      type="number"
                      suffix="chars"
                      value={String(formValues.shortTitleLength)}
                      onChange={(value) => handleChange(value, "shortTitleLength")}
                      autoComplete="off"
                      helpText="Example: 'Basic T-Shirt' (11 chars)"
                      min={0}
                    />
                    <TextField
                      label="Maximum Title Length"
                      type="number"
                      suffix="chars"
                      value={String(formValues.longTitleLength)}
                      onChange={(value) => handleChange(value, "longTitleLength")}
                      autoComplete="off"
                      helpText="Example: 'Men's Organic Cotton Basic Crew Neck T-Shirt - Black' (52 chars)"
                      min={0}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>

              <Divider />

              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">Description Length</Text>
                  <Text as="p" tone="subdued">
                    Control product description length for better conversion
                  </Text>
                  <InlineGrid columns={2} gap="400">
                    <TextField
                      label="Minimum Description Length"
                      type="number"
                      suffix="chars"
                      value={String(formValues.shortDescriptionLength)}
                      onChange={(value) => handleChange(value, "shortDescriptionLength")}
                      autoComplete="off"
                      helpText="Example: 'A comfortable basic t-shirt made from 100% cotton.' (52 chars)"
                      min={0}
                    />
                    <TextField
                      label="Maximum Description Length"
                      type="number"
                      suffix="chars"
                      value={String(formValues.longDescriptionLength)}
                      onChange={(value) => handleChange(value, "longDescriptionLength")}
                      autoComplete="off"
                      helpText="Recommended: 300-400 chars for optimal readability"
                      min={0}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Inventory Settings</Text>

              <Box padding="400">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">Stock Monitoring</Text>
                  <Text as="p" tone="subdued">
                    Control inventory alerts based on sales velocity
                  </Text>
                  <InlineGrid columns={3} gap="400">
                    <TextField
                      label="Understock Days"
                      type="number"
                      suffix="days"
                      value={String(formValues.understockDays)}
                      onChange={(value) => handleChange(value, "understockDays")}
                      autoComplete="off"
                      helpText="Days of stock remaining"
                      min={0}
                    />
                    <TextField
                      label="Overstock Days"
                      type="number"
                      suffix="days"
                      value={String(formValues.overstockDays)}
                      onChange={(value) => handleChange(value, "overstockDays")}
                      autoComplete="off"
                      helpText="Days of stock exceeding"
                      min={0}
                    />
                    <TextField
                      label="Passive Product Days"
                      type="number"
                      suffix="days"
                      value={String(formValues.passiveDays)}
                      onChange={(value) => handleChange(value, "passiveDays")}
                      autoComplete="off"
                      helpText="Days without sales"
                      min={0}
                    />
                  </InlineGrid>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card roundedAbove="sm">
            <BlockStack gap="200">
              <Text as="h2" variant="headingSm">Recommendations</Text>
              <Box paddingBlockStart="200">
                <Text as="p" variant="bodyMd">
                  Reinitialize all recommendations based on the settings above.
                </Text>
              </Box>
              <InlineStack align="end">
                <Button
                  variant="secondary"
                  tone="critical"
                  onClick={() => fetcher.submit({ action: 'reinitialize' }, { method: "post" })}
                  loading={fetcher.state === "submitting" }
                  accessibilityLabel="Reinitialize"
                >
                  Reinitialize
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
