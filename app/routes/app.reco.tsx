import {
  Page,
  IndexTable,
  IndexFilters,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
  INDEX_TABLE_SELECT_ALL_ITEMS,
  Link,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { RecommendationType, type Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAllProducts,
  initializeAllProductVariants,
  findRecommendations,
} from "../models/reco.server";
import { getShopifyAdminUrl } from "../utils/url";

type RecommendationData = {
  count: number;
  data: Recommendation[];
};

type LoaderData = { shop: string; data: Record<string, RecommendationData> };

async function getAllRecommendations(shop: string, page: number, size: number) {
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
      findRecommendations(shop, type, page, size)
    )
  );

  return {
    noImageProducts: recommendations[0],
    shortTitleProducts: recommendations[1],
    longTitleProducts: recommendations[2],
    shortDescriptionProducts: recommendations[3],
    longDescriptionProducts: recommendations[4],
    noStockProducts: recommendations[5],
    noCostProductVariants: recommendations[6],
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const size = Number(url.searchParams.get("size") ?? "10");

  const { session } = await authenticate.admin(request);
  const data = await getAllRecommendations(session.shop, page, size);

  return { shop: session.shop, data };
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  await initializeAllProducts(session.shop, admin.graphql);
  await initializeAllProductVariants(session.shop, admin.graphql);
  const data = await getAllRecommendations(session.shop, 1, 10);
  return { shop: session.shop, data };
}

const TAB_DEFINITIONS = [
  { id: "noImageProducts", content: "No Image" },
  { id: "shortTitleProducts", content: "Short Title" },
  { id: "longTitleProducts", content: "Long Title" },
  { id: "shortDescriptionProducts", content: "Short Desc" },
  { id: "longDescriptionProducts", content: "Long Desc" },
  { id: "noStockProducts", content: "No Stock" },
  { id: "noCostProductVariants", content: "No Cost" },
];

const PAGE_SIZE = 10;

export default function Index() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetcher.load(`/app/reco?page=${page}&size=${PAGE_SIZE}`);
  }, [page, PAGE_SIZE]);

  const recommendationsData = data?.data || {};
  const tabs = TAB_DEFINITIONS.filter((tab) =>
    recommendationsData[tab.id]?.count > 0
  );

  const recommendations = tabs.length > 0
    ? (fetcher.data?.data?.[tabs[selectedTab].id]?.data || recommendationsData[tabs[selectedTab].id]?.data)
    : [];

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(recommendations);

  if (tabs.length === 0) {
    return (
      <Page
        title="Recommendations"
        primaryAction={{
          content: "Initialize",
          onAction: () => fetcher.submit(null, { method: "post" }),
          loading: fetcher.state === "submitting",
        }}
      >
        <Text as="span">There are no recommendations to show.</Text>
      </Page>
    );
  }

  const totalCount =
    fetcher.data?.data?.[tabs[selectedTab].id]?.count ?? data.data[tabs[selectedTab].id].count;

  const shop = fetcher.data?.shop ?? data.shop;

  const resourceName = {
    singular: "Recommendation",
    plural: "Recommendations",
  };

  const truncate = (str: string, length = 50) =>
    str?.length > length ? str.slice(0, length) + "…" : str || "";

  const rowMarkup = recommendations.map((recommendation, index) => {
    return (
      <IndexTable.Row
        id={recommendation.id}
        key={recommendation.id}
        selected={selectedResources.includes(recommendation.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Link
            dataPrimaryLink
            url={getShopifyAdminUrl(shop, recommendation.targetUrl)}
            target="_blank"
          >
            <Text fontWeight="bold" as="span">
              {truncate(recommendation.targetTitle)}
            </Text>
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(recommendation.createdAt).toLocaleDateString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setPage(1);
    fetcher.load(`/app/reco?page=1&size=${PAGE_SIZE}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetcher.load(`/app/reco?page=${newPage}&size=${PAGE_SIZE}`);
  };

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
        onSelect={handleTabChange}
        mode={mode}
        setMode={setMode}
        filters={[]}
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
          allResourcesSelected ? INDEX_TABLE_SELECT_ALL_ITEMS : selectedResources.length
        }
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Title" },
          { title: "Date Created" },
        ]}
        pagination={{
          hasPrevious: page > 1,
          onPrevious: () => handlePageChange(page - 1),
          hasNext: page < Math.ceil(totalCount / PAGE_SIZE),
          onNext: () => handlePageChange(page + 1),
          label: `${page} of ${Math.ceil(totalCount / PAGE_SIZE)} page - ${recommendations.length} of ${totalCount} results`,
        }}
      >
        {rowMarkup}
      </IndexTable>
    </Page>
  );
}
