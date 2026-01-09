import {
  Page,
  Card,
  BlockStack,
  Text,
  InlineStack,
  Spinner,
  ProgressBar,
} from "@shopify/polaris";
import { useState, useEffect } from "react";

export function RecommendationsLoader() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress over time
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Cap at 90% until actual completion
        return prev + 2;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <Page title="Recommendations">
      <Card>
        <BlockStack gap="500">
          <InlineStack align="center">
            <Spinner size="large" />
          </InlineStack>

          <BlockStack gap="300" inlineAlign="center">
            <Text as="h2" variant="headingMd" alignment="center">
              Analyzing your store...
            </Text>
            <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
              Smart Forecast is currently scanning your products and generating personalized recommendations.
            </Text>
          </BlockStack>

          <div style={{ maxWidth: "400px", margin: "0 auto", width: "100%" }}>
            <ProgressBar progress={progress} size="small" />
          </div>

          <BlockStack gap="200">
            <Text as="p" variant="bodyMd" alignment="center">
              This usually takes a few minutes depending on your catalog size.
            </Text>
            <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
              We're checking for:
            </Text>
            <InlineStack align="center">
              <BlockStack gap="100">
                <Text as="p" variant="bodySm" alignment="center">
                  💰 Pricing optimizations
                </Text>
                <Text as="p" variant="bodySm" alignment="center">
                  📝 Content improvements
                </Text>
                <Text as="p" variant="bodySm" alignment="center">
                  📸 Missing media
                </Text>
                <Text as="p" variant="bodySm" alignment="center">
                  📦 Inventory issues
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>

          <Text as="p" variant="bodySm" alignment="center" tone="subdued">
            You can refresh this page in a few minutes to see your recommendations, or they will appear automatically once ready.
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}
