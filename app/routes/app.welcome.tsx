import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Icon,
  List,
} from "@shopify/polaris";
import {
  AlertCircleIcon,
  ChartVerticalIcon,
  ProductIcon,
} from "@shopify/polaris-icons";
import { RecommendationStatus } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { getShop, completeOnboarding } from "../models/shop.business.server";
import { getRecommendationCounts } from "../models/recommendation.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session.shop);

  // If onboarding is already completed, redirect to recommendations
  if (shop.onboardingCompleted) {
    return redirect("/app/reco");
  }

  // Check if recommendations are being generated
  const counts = await getRecommendationCounts(request, RecommendationStatus.PENDING);
  const totalRecommendations = Object.values(counts).reduce((sum, count) => sum + count.all, 0);

  return {
    hasRecommendations: totalRecommendations > 0,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);

  await completeOnboarding(session.shop);

  return redirect("/app/reco");
}

export default function Welcome() {
  const { hasRecommendations } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <Page narrowWidth>
      <BlockStack gap="600">
        <Card>
          <BlockStack gap="400">
            <InlineStack align="center">
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "#f1f1f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Icon source={ChartVerticalIcon} tone="base" />
              </div>
            </InlineStack>

            <Text as="h1" variant="headingXl" alignment="center">
              Welcome to Smart Forecast
            </Text>

            <Text as="p" variant="bodyLg" alignment="center" tone="subdued">
              Your AI-powered recommendation engine for optimizing your Shopify store
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <Icon source={AlertCircleIcon} tone="info" />
              <Text as="h2" variant="headingMd">
                What Smart Forecast does for you
              </Text>
            </InlineStack>

            <List type="bullet">
              <List.Item>
                <Text as="span" variant="bodyMd">
                  <strong>Smart Pricing Analysis:</strong> Identifies products with pricing issues, extreme discounts, or products being sold at a loss
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodyMd">
                  <strong>Content Optimization:</strong> Detects products with missing or poorly formatted titles and descriptions
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodyMd">
                  <strong>Media Management:</strong> Finds products missing images to improve visual appeal
                </Text>
              </List.Item>
              <List.Item>
                <Text as="span" variant="bodyMd">
                  <strong>Inventory Intelligence:</strong> Alerts you to understocked, overstocked, or passive inventory items
                </Text>
              </List.Item>
            </List>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="center">
              <Icon source={ProductIcon} tone="success" />
              <Text as="h2" variant="headingMd">
                {hasRecommendations ? "Your recommendations are ready!" : "Analyzing your store..."}
              </Text>
            </InlineStack>

            {hasRecommendations ? (
              <Text as="p" variant="bodyMd">
                We've analyzed your store and generated personalized recommendations. Click below to view your insights and start optimizing your store.
              </Text>
            ) : (
              <BlockStack gap="300">
                <Text as="p" variant="bodyMd">
                  Smart Forecast is currently analyzing your products and generating recommendations. This usually takes a few minutes depending on your catalog size.
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  You can start exploring the app now, and your recommendations will appear automatically as they're generated.
                </Text>
              </BlockStack>
            )}

            <InlineStack align="center">
              <fetcher.Form method="post">
                <Button
                  variant="primary"
                  size="large"
                  submit
                  loading={isSubmitting}
                >
                  {hasRecommendations ? "View Recommendations" : "Get Started"}
                </Button>
              </fetcher.Form>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
