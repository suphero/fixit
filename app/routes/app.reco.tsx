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
  getRecommendationCount,
  getRecommendationList,
} from "../models/reco.server";
import { getShopifyAdminUrl } from "../utils/url";

type RecommendationCount = Record<string, number>;
type LoaderData = {
  shop: string;
  counts: RecommendationCount;
  activeTab?: {
    id: string;
    data: Recommendation[];
    count: number;
  }
};

async function getAllCounts(shop: string) {
  const counts = await Promise.all(
    [
      RecommendationType.NO_IMAGE,
      RecommendationType.SHORT_TITLE,
      RecommendationType.LONG_TITLE,
      RecommendationType.SHORT_DESCRIPTION,
      RecommendationType.LONG_DESCRIPTION,
      RecommendationType.NO_STOCK,
      RecommendationType.NO_COST,
    ].map(async (type) => {
      const count = await getRecommendationCount(shop, type);
      return [TAB_DEFINITIONS.find(tab => tab.type === type)?.id ?? '', count] as const;
    })
  );

  return Object.fromEntries(counts);
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const size = Number(url.searchParams.get("size") ?? "10");
  const tabId = url.searchParams.get("tab");

  const { session } = await authenticate.admin(request);
  const counts = await getAllCounts(session.shop);

  let activeTab;
  if (tabId) {
    const type = TAB_DEFINITIONS.find(tab => tab.id === tabId)?.type;
    if (type) {
      const [count, data] = await Promise.all([
        getRecommendationCount(session.shop, type),
        getRecommendationList(session.shop, type, page, size),
      ]);
      activeTab = { id: tabId, count, data };
    }
  }

  return { shop: session.shop, counts, activeTab };
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  await initializeAllProducts(session.shop, admin.graphql);
  await initializeAllProductVariants(session.shop, admin.graphql);

  const counts = await getAllCounts(session.shop);
  return { shop: session.shop, counts };
}

const TAB_DEFINITIONS = [
  { id: "noImageProducts", content: "No Image", type: RecommendationType.NO_IMAGE },
  { id: "shortTitleProducts", content: "Short Title", type: RecommendationType.SHORT_TITLE },
  { id: "longTitleProducts", content: "Long Title", type: RecommendationType.LONG_TITLE },
  { id: "shortDescriptionProducts", content: "Short Desc", type: RecommendationType.SHORT_DESCRIPTION },
  { id: "longDescriptionProducts", content: "Long Desc", type: RecommendationType.LONG_DESCRIPTION },
  { id: "noStockProducts", content: "No Stock", type: RecommendationType.NO_STOCK },
  { id: "noCostProductVariants", content: "No Cost", type: RecommendationType.NO_COST },
];

const PAGE_SIZE = 10;

export default function Index() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);

  const tabs = TAB_DEFINITIONS.filter((tab) => data.counts[tab.id] > 0);

  useEffect(() => {
    if (tabs.length > 0) {
      fetcher.load(`/app/reco?tab=${tabs[selectedTab].id}&page=${page}&size=${PAGE_SIZE}`);
    }
  }, [selectedTab, page]);

  const activeTabData = fetcher.data?.activeTab ?? data.activeTab;
  const recommendations = activeTabData?.data ?? [];
  const totalCount = activeTabData?.count ?? 0;

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(recommendations);

  const isLoading = fetcher.state !== "idle";

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
    fetcher.load(`/app/reco?tab=${tabs[selectedTabIndex].id}&page=1&size=${PAGE_SIZE}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetcher.load(`/app/reco?tab=${tabs[selectedTab].id}&page=${newPage}&size=${PAGE_SIZE}`);
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
        loading={isLoading}
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
        loading={isLoading}
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
