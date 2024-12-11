// app/routes/app.reco.tsx
import { json } from "@remix-run/node";
import {
  Page,
  Card,
  Layout,
  IndexTable,
  Button,
  Text,
  InlineGrid,
} from "@shopify/polaris";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAllProducts,
  initializeAllProductVariants,
  listProductsByType,
  listProductVariantsByType
} from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);
  const noImageProducts = await listProductsByType(session.shop, "NO_IMAGE");
  const shortTitleProducts = await listProductsByType(session.shop, "SHORT_TITLE");
  const longTitleProducts = await listProductsByType(session.shop, "LONG_TITLE");
  const shortDescriptionProducts = await listProductsByType(session.shop, "SHORT_DESCRIPTION");
  const longDescriptionProducts = await listProductsByType(session.shop, "LONG_DESCRIPTION");
  const noStockProducts = await listProductsByType(session.shop, "NO_STOCK");
  const noCostProductVariants = await listProductVariantsByType(session.shop, "NO_COST");
  return json({
    noImageProducts,
    shortTitleProducts,
    longTitleProducts,
    shortDescriptionProducts,
    longDescriptionProducts,
    noStockProducts,
    noCostProductVariants
  });
}

export async function action({ request }: any) {
  const { admin, session } = await authenticate.admin(request);
  await initializeAllProducts(session.shop, admin.graphql);
  await initializeAllProductVariants(session.shop, admin.graphql);

  const noImageProducts = await listProductsByType(session.shop, "NO_IMAGE");
  const shortTitleProducts = await listProductsByType(session.shop, "SHORT_TITLE");
  const longTitleProducts = await listProductsByType(session.shop, "LONG_TITLE");
  const shortDescriptionProducts = await listProductsByType(session.shop, "SHORT_DESCRIPTION");
  const longDescriptionProducts = await listProductsByType(session.shop, "LONG_DESCRIPTION");
  const noStockProducts = await listProductsByType(session.shop, "NO_STOCK");
  const noCostProductVariants = await listProductVariantsByType(session.shop, "NO_COST");

  return json({
    noImageProducts,
    shortTitleProducts,
    longTitleProducts,
    shortDescriptionProducts,
    longDescriptionProducts,
    noStockProducts,
    noCostProductVariants
  });
}

function truncate(str: string, { length = 50 } = {}) {
  return str?.length > length ? str.slice(0, length) + "…" : str || "";
}

const RecommendationTable = ({ recommendations }: { recommendations: Recommendation[] }) => (
  <IndexTable
    resourceName={{
      singular: "Recommendation",
      plural: "Recommendations",
    }}
    itemCount={recommendations.length}
    headings={[
      { title: "Title" },
      { title: "Date created" },
    ]}
    selectable={false}
  >
    {recommendations.map((recommendation) => (
      <RecommendationRow key={recommendation.id} recommendation={recommendation} />
    ))}
  </IndexTable>
);

// Reusable Table Row Component
const RecommendationRow = ({
  recommendation,
}: {
  recommendation: Recommendation;
}) => (
  <IndexTable.Row id={recommendation.id} position={recommendation.id}>
    <IndexTable.Cell>
      <Text>{truncate(recommendation.targetTitle)}</Text>
    </IndexTable.Cell>
    <IndexTable.Cell>
      {new Date(recommendation.createdAt).toDateString()}
    </IndexTable.Cell>
  </IndexTable.Row>
);

export default function Index() {
  const { noImageProducts, shortTitleProducts, longTitleProducts, shortDescriptionProducts, longDescriptionProducts, noStockProducts, noCostProductVariants } = useLoaderData<{ noImageProducts: Recommendation[], shortTitleProducts: Recommendation[], longTitleProducts: Recommendation[], shortDescriptionProducts: Recommendation[], longDescriptionProducts: Recommendation[], noStockProducts: Recommendation[], noCostProductVariants: Recommendation[] }>();
  const fetcher = useFetcher<{ noImageProducts: Recommendation[], shortTitleProducts: Recommendation[], longTitleProducts: Recommendation[], shortDescriptionProducts: Recommendation[], longDescriptionProducts: Recommendation[], noStockProducts: Recommendation[], noCostProductVariants: Recommendation[] }>();

  const handleInitialize = () => {
    fetcher.submit(null, { method: "post" });
  };

  return (
    <Page
      title="Recommendations"
      primaryAction={
        <Button
          variant="primary"
          onClick={() => handleInitialize()}
          loading={fetcher.state === "submitting"}
          accessibilityLabel="Initialize">
            Initialize
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                No Image Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.noImageProducts || noImageProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                Short Title Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.shortTitleProducts || shortTitleProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                Long Title Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.longTitleProducts || longTitleProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                Short Description Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.shortDescriptionProducts || shortDescriptionProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                Long Description Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.longDescriptionProducts || longDescriptionProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                No Stock Products
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.noStockProducts || noStockProducts}
            />
          </Card>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                No Cost Product Variants
              </Text>
            </InlineGrid>
            <RecommendationTable
              recommendations={fetcher.data?.noCostProductVariants || noCostProductVariants}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
