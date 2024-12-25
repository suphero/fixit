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
} from "@shopify/polaris";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { getShopSettings, updateShopSettings } from "../models/settings.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const settings = await getShopSettings(request);
  return { settings };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const updates = {
    // Pricing
    minRevenueRate: Number(formData.get("minRevenueRate")),
    maxRevenueRate: Number(formData.get("maxRevenueRate")),
    lowDiscountRate: Number(formData.get("lowDiscountRate")),
    highDiscountRate: Number(formData.get("highDiscountRate")),
    // Content
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

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [formValues, setFormValues] = useState(settings);

  const handleSubmit = useCallback(() => {
    fetcher.submit(formValues, { method: "post" });
  }, [formValues]);

  const handleChange = useCallback((value: string, id: string) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const formatPercent = (value: number) => `${(value * 100).toFixed(0)}%`;

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
                      value={String(formValues.minRevenueRate * 100)}
                      onChange={(value) => handleChange(String(Number(value) / 100), "minRevenueRate")}
                      autoComplete="off"
                      helpText={`Example: Cost $100 + ${formatPercent(formValues.minRevenueRate)} = Min Price $${(100 * (1 + Number(formValues.minRevenueRate))).toFixed(2)}`}
                      min={0}
                    />
                    <TextField
                      label="Maximum Revenue Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.maxRevenueRate * 100)}
                      onChange={(value) => handleChange(String(Number(value) / 100), "maxRevenueRate")}
                      autoComplete="off"
                      helpText={`Example: Cost $100 + ${formatPercent(formValues.maxRevenueRate)} = Max Price $${(100 * (1 + Number(formValues.maxRevenueRate))).toFixed(2)}`}
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
                      value={String(formValues.lowDiscountRate * 100)}
                      onChange={(value) => handleChange(String(Number(value) / 100), "lowDiscountRate")}
                      autoComplete="off"
                      helpText={`Example: Compare $100 - ${formatPercent(formValues.lowDiscountRate)} = Price $${(100 * (1 - Number(formValues.lowDiscountRate))).toFixed(2)}`}
                      min={0}
                    />
                    <TextField
                      label="High Discount Rate"
                      type="number"
                      suffix="%"
                      value={String(formValues.highDiscountRate * 100)}
                      onChange={(value) => handleChange(String(Number(value) / 100), "highDiscountRate")}
                      autoComplete="off"
                      helpText={`Example: Compare $100 - ${formatPercent(formValues.highDiscountRate)} = Price $${(100 * (1 - Number(formValues.highDiscountRate))).toFixed(2)}`}
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
              <Text variant="headingMd" as="h2">Content Settings</Text>

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
      </Layout>
    </Page>
  );
}
