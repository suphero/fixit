// app/routes/app.reco.tsx
import { json } from "@remix-run/node";
import {
  Page,
  IndexTable,
  IndexFilters,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from "@shopify/polaris";
import { useState } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { Recommendation } from "@prisma/client";
import { RecommendationType } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAllProducts,
  initializeAllProductVariants,
  findRecommendations,
} from "../models/reco.server";

export async function loader({ request }: any) {
  const { session } = await authenticate.admin(request);

  const recommendations = await Promise.all([
    findRecommendations(session.shop, RecommendationType.NO_IMAGE),
    findRecommendations(session.shop, RecommendationType.SHORT_TITLE),
    findRecommendations(session.shop, RecommendationType.LONG_TITLE),
    findRecommendations(session.shop, RecommendationType.SHORT_DESCRIPTION),
    findRecommendations(session.shop, RecommendationType.LONG_DESCRIPTION),
    findRecommendations(session.shop, RecommendationType.NO_STOCK),
    findRecommendations(session.shop, RecommendationType.NO_COST),
  ]);

  return json({
    noImageProducts: recommendations[0],
    shortTitleProducts: recommendations[1],
    longTitleProducts: recommendations[2],
    shortDescriptionProducts: recommendations[3],
    longDescriptionProducts: recommendations[4],
    noStockProducts: recommendations[5],
    noCostProductVariants: recommendations[6],
  });
}

export async function action({ request }: any) {
  const { admin, session } = await authenticate.admin(request);
  await initializeAllProducts(session.shop, admin.graphql);
  await initializeAllProductVariants(session.shop, admin.graphql);
  const recommendations = await loader({ request });
  return recommendations;
}

export default function Index() {
  const data = useLoaderData<Record<string, Recommendation[]>>();
  const fetcher = useFetcher<Record<string, Recommendation[]>>();
  const {mode, setMode} = useSetIndexFiltersMode();

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: "noImageProducts", content: "No Image" },
    { id: "shortTitleProducts", content: "Short Title" },
    { id: "longTitleProducts", content: "Long Title" },
    { id: "shortDescriptionProducts", content: "Short Desc" },
    { id: "longDescriptionProducts", content: "Long Desc" },
    { id: "noStockProducts", content: "No Stock" },
    { id: "noCostProductVariants", content: "No Cost" },
  ];

  const recommendations = fetcher.data?.[tabs[selectedTab].id] || data[tabs[selectedTab].id];
  const resourceName = { singular: "Recommendation", plural: "Recommendations" };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(recommendations);

  const truncate = (str: string, length = 50) =>
    str?.length > length ? str.slice(0, length) + "…" : str || "";

  const rowMarkup = recommendations.map((recommendation, index) => (
    <IndexTable.Row
      id={recommendation.id}
      key={recommendation.id}
      selected={selectedResources.includes(recommendation.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="h2">
          {truncate(recommendation.targetTitle)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(recommendation.createdAt).toDateString()}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Recommendations"
      primaryAction={{
        content: "Initialize",
        onAction: () => fetcher.submit(null, { method: "post" }),
        loading: fetcher.state === "submitting",
      }}
    >
      <IndexFilters
        tabs={tabs}
        selected={selectedTab}
        onSelect={setSelectedTab}
        mode={mode}
        setMode={setMode}
        filters={[]}
        appliedFilters={[]}
        onQueryChange={() => {}}
        onQueryClear={() => {}}
        onClearAll={() => {}}
        canCreateNewView={false}
        hideFilters
        hideQueryField
      />
      <IndexTable
        resourceName={resourceName}
        itemCount={recommendations.count}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Title" },
          { title: "Date Created" },
        ]}
      >
        {rowMarkup}
      </IndexTable>
    </Page>
  );
}
