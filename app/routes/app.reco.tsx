import { json } from "@remix-run/node";
import {
  Page,
  Card,
  Layout,
  IndexTable,
  Button,
  Text,
} from "@shopify/polaris";
import { useLoaderData, Link, useFetcher } from "@remix-run/react";
import type { Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import { initializeNoImageProductSuggestions, listNoImageProductSuggestions } from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);
  const recos = await listNoImageProductSuggestions(session.shop);

  return json({
    recos: recos || []
  });
}

export async function action({ request }: any) {
  const { admin, session } = await authenticate.admin(request);
  await initializeNoImageProductSuggestions(session.shop, admin.graphql);
  return json({ success: true });
}

function truncate(str: string, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const QRTable = ({ recos }: any) => (
  <IndexTable
    resourceName={{
      singular: "Recommendation",
      plural: "Recommendations",
    }}
    itemCount={recos.length}
    headings={[
      { title: "Title" },
      { title: "Date created" },
    ]}
    selectable={false}
    pagination={{
      hasNext: true,
      hasPrevious: false,
      label: "1-1 of 1",
      onNext: () => {},
      onPrevious: () => {},
    }}
  >
    {recos.map((reco: any) => (
      <QRTableRow key={reco.id} reco={reco} />
    ))}
  </IndexTable>
);

const QRTableRow = ({ reco }: any) => (
  <IndexTable.Row id={reco.id} position={reco.id}>
    <IndexTable.Cell>
      <Link to={`qrcodes/${reco.id}`}>{truncate(reco.targetTitle)}</Link>
    </IndexTable.Cell>
    <IndexTable.Cell>
      {new Date(reco.createdAt).toDateString()}
    </IndexTable.Cell>
  </IndexTable.Row>
);

export default function Index() {
  const { recos } = useLoaderData<{ recos: Recommendation[] }>();
  const fetcher = useFetcher<{ recos: Recommendation[] }>();

  const handleInitialize = async () => {
    fetcher.submit(null, { method: "post" });
  };

  return (
    <Page
      title="Recommendations"
      primaryAction={
        <Button variant="primary" onClick={handleInitialize} loading={fetcher.state === "submitting"}>
          Initialize
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card roundedAbove="sm">
            <Text as="h2" variant="headingSm">
              Product with no image
            </Text>
            <QRTable recos={fetcher.data?.recos || recos} />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
