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
  initializeNoImageProducts,
  listNoImageProducts,
  initializeShortTitleProducts,
  listShortTitleProducts,
  initializeLongTitleProducts,
  listLongTitleProducts,
} from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);
  const noImageProducts = await listNoImageProducts(session.shop);
  const shortTitleProducts = await listShortTitleProducts(session.shop);
  const longTitleProducts = await listLongTitleProducts(session.shop);
  return json({
    noImageProducts,
    shortTitleProducts,
    longTitleProducts,
  });
}

export async function action({ request }: any) {
  const formData = await request.formData();
  const actionType = formData.get("actionType");
  const { admin, session } = await authenticate.admin(request);

  if (actionType === "NO_IMAGE") {
    await initializeNoImageProducts(session.shop, admin.graphql);
  } else if (actionType === "SHORT_TITLE") {
    await initializeShortTitleProducts(session.shop, admin.graphql);
  } else if (actionType === "LONG_TITLE") {
    await initializeLongTitleProducts(session.shop, admin.graphql);
  }

  const noImageProducts = await listNoImageProducts(session.shop);
  const shortTitleProducts = await listShortTitleProducts(session.shop);

  return json({
    noImageProducts,
    shortTitleProducts,
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

  const handleInitialize = (actionType: string) => {
    fetcher.submit({ actionType }, { method: "post" });
  };

  return (
    <Page title="Recommendations">
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingSm">
                No Image Products
              </Text>
              <Button
                onClick={() => handleInitialize("NO_IMAGE")}
                loading={fetcher.state === "submitting"}
                accessibilityLabel="Initialize"
              >
                Initialize
              </Button>
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
              <Button
                onClick={() => handleInitialize("SHORT_TITLE")}
                loading={fetcher.state === "submitting"}
                accessibilityLabel="Initialize"
              >
                Initialize
              </Button>
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
              <Button
                onClick={() => handleInitialize("LONG_TITLE")}
                loading={fetcher.state === "submitting"}
                accessibilityLabel="Initialize"
              >
                Initialize
              </Button>
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
