import {
  Page,
  IndexTable,
  IndexFilters,
  Text,
  useSetIndexFiltersMode,
  Button,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { RecommendationType, Recommendation } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAllProducts,
  initializeAllProductVariants,
  getAllCounts,
  getRecommendationList,
  skipRecommendation,
} from "../models/reco.server";
import { getShopSettings } from "../models/settings.server";
import { getShopifyAdminUrl } from "../utils/url";
import { UpdateTitleModal } from "./app.reco.update-title";
import { UpdatePriceModal } from "./app.reco.update-price";

type RecommendationCount = Record<RecommendationType, number>;
type LoaderData = {
  shop: string;
  counts: RecommendationCount;
  settings: {
    shortTitleLength: number;
    longTitleLength: number;
    shortDescriptionLength: number;
    longDescriptionLength: number;
    minRevenueRate: number;
    maxRevenueRate: number;
    lowDiscountRate: number;
    highDiscountRate: number;
  };
  activeTab?: {
    id: string;
    data: Recommendation[];
    count: number;
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const size = Number(url.searchParams.get("size") ?? "10");
  const tabId = url.searchParams.get("tab");
  const showSkipped = url.searchParams.get("showSkipped") === "true";

  const { session } = await authenticate.admin(request);
  const [typeCounts, settings] = await Promise.all([
    getAllCounts(request, showSkipped),
    getShopSettings(request)
  ]);

  let activeTab;
  if (tabId) {
    const type = tabId as RecommendationType;
    if (TAB_DEFINITIONS[type]) {
      const data = await getRecommendationList(request, type, page, size, showSkipped);
      activeTab = { id: type, count: typeCounts[type] ?? 0, data };
    }
  }

  return { shop: session.shop, counts: typeCounts, settings, activeTab };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { admin, session } = await authenticate.admin(request);
  const action = formData.get('action');
  const showSkipped = formData.get('showSkipped') === 'true';

  if (action === 'skip') {
    const recommendationId = formData.get('recommendationId') as string;
    await skipRecommendation(request, recommendationId);

    const counts = await getAllCounts(request, showSkipped);
    return { shop: session.shop, counts };
  }

  await initializeAllProducts(request, admin.graphql);
  await initializeAllProductVariants(request, admin.graphql);

  const counts = await getAllCounts(request, showSkipped);
  return { shop: session.shop, counts };
}

const TAB_DEFINITIONS: Record<RecommendationType, string> = {
  NO_IMAGE: "No Image",
  SHORT_TITLE: "Short Title",
  LONG_TITLE: "Long Title",
  SHORT_DESCRIPTION: "Short Desc",
  LONG_DESCRIPTION: "Long Desc",
  NO_STOCK: "No Stock",
  NO_COST: "No Cost",
  SALE_AT_LOSS: "Sale at Loss",
  CHEAP: "Cheap",
  EXPENSIVE: "Expensive",
  LOW_DISCOUNT: "Low Discount",
  HIGH_DISCOUNT: "High Discount",
  UNDERSTOCK: "Understock",
  OVERSTOCK: "Overstock",
  PASSIVE: "Passive",
} as const;

const PAGE_SIZE = 10;

export default function Index() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTitleRecommendation, setSelectedTitleRecommendation] = useState<Recommendation | null>(null);
  const [selectedPriceRecommendation, setSelectedPriceRecommendation] = useState<Recommendation | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const tabs = Object.entries(TAB_DEFINITIONS)
    .map(([type, content]) => {
      const count = (fetcher.data?.counts ?? data.counts)[type as RecommendationType] ?? 0;
      return {
        content: count > 0 ? `${content} (${count})` : content,
        id: type,
      };
    })
    .filter((tab) => (fetcher.data?.counts ?? data.counts)[tab.id as RecommendationType] > 0);

  useEffect(() => {
    if (tabs.length > 0) {
      fetcher.load(`/app/reco?tab=${tabs[selectedTab].id}&page=${page}&size=${PAGE_SIZE}&showSkipped=${showSkipped}`);
    }
  }, [tabs.length, selectedTab, page, showSkipped]);

  const activeTabData = fetcher.data?.activeTab ?? data.activeTab;
  const recommendations = activeTabData?.data ?? [];
  const totalCount = activeTabData?.count ?? 0;

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
    const createdAt = new Date(recommendation.createdAt);
    const updatedAt = new Date(recommendation.updatedAt);
    return (
      <IndexTable.Row
        id={recommendation.id}
        key={recommendation.id}
        position={index}
      >
        <IndexTable.Cell>
          <Button
            variant="plain"
            onClick={() => {
              window.open(getShopifyAdminUrl(shop, recommendation.targetUrl), '_blank');
            }}
          >
            {truncate(recommendation.targetTitle)}
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {createdAt.toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {recommendation.status === 'IGNORED' ? (
            <Button
              onClick={() => {
                fetcher.submit(
                  {
                    action: 'unskip',
                    recommendationId: recommendation.id,
                  },
                  { method: 'post' }
                );
              }}
            >
              Unskip
            </Button>
          ) : (
            <>
              {(recommendation.type === 'SHORT_TITLE' ||
                recommendation.type === 'LONG_TITLE') && (
                <Button
                  onClick={() => {
                    setSelectedTitleRecommendation({
                      ...recommendation,
                      createdAt,
                      updatedAt,
                    });
                  }}
                >
                  Edit Title
                </Button>
              )}
              {(recommendation.type === 'CHEAP' ||
                recommendation.type === 'EXPENSIVE') && (
                <Button
                  onClick={() => {
                    setSelectedPriceRecommendation({
                      ...recommendation,
                      createdAt,
                      updatedAt,
                    });
                  }}
                >
                  Edit Price
                </Button>
              )}
              <Button
                tone="critical"
                onClick={() => {
                  fetcher.submit(
                    {
                      action: 'skip',
                      recommendationId: recommendation.id,
                    },
                    { method: 'post' }
                  );
                }}
              >
                Skip
              </Button>
            </>
          )}
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
      <div style={{ padding: "16px 0" }}>
        <Button
          onClick={() => setShowSkipped(!showSkipped)}
          pressed={showSkipped}
        >
          {showSkipped ? "Hide Skipped" : "Show Skipped"}
        </Button>
      </div>
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
      <UpdateTitleModal
        recommendation={selectedTitleRecommendation}
        settings={data.settings}
        onClose={() => setSelectedTitleRecommendation(null)}
      />
      <UpdatePriceModal
        recommendation={selectedPriceRecommendation}
        settings={data.settings}
        onClose={() => setSelectedPriceRecommendation(null)}
      />
      <IndexTable
        resourceName={resourceName}
        itemCount={totalCount}
        headings={[
          { title: "Title" },
          { title: "Date Created" },
          { title: "" },
        ]}
        loading={isLoading}
        selectable={false}
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
