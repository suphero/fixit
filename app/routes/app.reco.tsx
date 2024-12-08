// app/routes/app.reco.tsx
import { json } from "@remix-run/node";
import {
  Page,
  Card,
  Layout,
  IndexTable,
  Button,
  Text,
} from "@shopify/polaris";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeNoImageProductSuggestions,
  listNoImageProductSuggestions,
} from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);
  const recommendations = await listNoImageProductSuggestions(session.shop);
  return json({ recommendations: recommendations || [] });
}

export async function action({ request }: any) {
  const { admin, session } = await authenticate.admin(request);
  await initializeNoImageProductSuggestions(session.shop, admin.graphql);
  const recommendations = await listNoImageProductSuggestions(session.shop);
  return json({ recommendations });
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
  const { recommendations } = useLoaderData<{ recommendations: Recommendation[] }>();
  const fetcher = useFetcher<{ recommendations: Recommendation[] }>();

  const handleInitialize = () => {
    fetcher.submit(null, { method: "post" });
  };

  return (
    <Page
      title="Recommendations"
      primaryAction={
        <Button
          onClick={handleInitialize}
          loading={fetcher.state === "submitting"}
        >
          Initialize
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <Text as="h2" variant="headingSm">
              Products with No Images
            </Text>
            <RecommendationTable
              recommendations={fetcher.data?.recommendations || recommendations}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
