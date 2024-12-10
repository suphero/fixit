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
  listProductsByType
} from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);
  const noImageProducts = await listProductsByType(session.shop, "NO_IMAGE");
  const shortTitleProducts = await listProductsByType(session.shop, "SHORT_TITLE");
  const longTitleProducts = await listProductsByType(session.shop, "LONG_TITLE");
  return json({
    noImageProducts,
    shortTitleProducts,
    longTitleProducts,
  });
}

export async function action({ request }: any) {
  const { admin, session } = await authenticate.admin(request);
  await initializeAllProducts(session.shop, admin.graphql);

  const noImageProducts = await listProductsByType(session.shop, "NO_IMAGE");
  const shortTitleProducts = await listProductsByType(session.shop, "SHORT_TITLE");
  const longTitleProducts = await listProductsByType(session.shop, "LONG_TITLE");

  return json({
    noImageProducts,
    shortTitleProducts,
    longTitleProducts,
  });
}

function truncate(str: string, { length = 25 } = {}) {
  return str?.length > length ? str.slice(0, length) + "…" : str || "";
}

// Reusable Table Component
const RecommendationTable = ({
  recommendations,
}: {
  recommendations: Recommendation[];
}) => (
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
  const { noImageProducts, shortTitleProducts, longTitleProducts } = useLoaderData<{ noImageProducts: Recommendation[], shortTitleProducts: Recommendation[], longTitleProducts: Recommendation[] }>();
  const fetcher = useFetcher<{ noImageProducts: Recommendation[], shortTitleProducts: Recommendation[], longTitleProducts: Recommendation[] }>();

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
        </Layout.Section>
      </Layout>
    </Page>
  );
}
