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
import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { RecommendationType, type Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAllProducts,
  initializeAllProductVariants,
  findRecommendations,
} from "../models/reco.server";

export async function loader({ request }: any) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const size = Number(url.searchParams.get("size") || "10");

  const { session } = await authenticate.admin(request);

  const recommendations = await Promise.all(
    [
      RecommendationType.NO_IMAGE,
      RecommendationType.SHORT_TITLE,
      RecommendationType.LONG_TITLE,
      RecommendationType.SHORT_DESCRIPTION,
      RecommendationType.LONG_DESCRIPTION,
      RecommendationType.NO_STOCK,
      RecommendationType.NO_COST,
    ].map((type) =>
      findRecommendations(session.shop, type, page, size)
    )
  );

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
  return loader({ request });
}

export default function Index() {
  const fetcher = useFetcher();
  const data = useLoaderData<Record<string, { count: number; pagedData: Recommendation[] }>>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);
  const [size, _setSize] = useState(10);

  const tabs = [
    { id: "noImageProducts", content: "No Image" },
    { id: "shortTitleProducts", content: "Short Title" },
    { id: "longTitleProducts", content: "Long Title" },
    { id: "shortDescriptionProducts", content: "Short Desc" },
    { id: "longDescriptionProducts", content: "Long Desc" },
    { id: "noStockProducts", content: "No Stock" },
    { id: "noCostProductVariants", content: "No Cost" },
  ];

  const recommendations =
    fetcher.data?.[tabs[selectedTab].id]?.data || data[tabs[selectedTab].id].data;

  const totalCount =
    fetcher.data?.[tabs[selectedTab].id]?.count || data[tabs[selectedTab].id].count;

  const resourceName = {
    singular: "Recommendation",
    plural: "Recommendations",
  };

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

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetcher.load(`/app/reco?page=${newPage}&size=${size}`);
  };

  useEffect(() => {
    fetcher.load(`/app/reco?page=${page}&size=${size}`);
  }, [page, size]);

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
        itemCount={totalCount}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Title" },
          { title: "Date Created" },
        ]}
        emptyState={
          totalCount === 0 && (
            <Text variant="bodyMd" as="p">
              No recommendations found.
            </Text>
          )
        }
        pagination={{
          hasPrevious: page > 1,
          onPrevious: () => handlePageChange(page - 1),
          hasNext: page < Math.ceil(totalCount / size),
          onNext: () => handlePageChange(page + 1),
        }}
      >
        {rowMarkup}
      </IndexTable>
    </Page>
  );
}
