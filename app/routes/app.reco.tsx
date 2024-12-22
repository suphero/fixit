import {
  Page,
  IndexTable,
  IndexFilters,
  Text,
  useSetIndexFiltersMode,
  Button,
  ButtonGroup,
  Badge,
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { Recommendation } from "@prisma/client";
import { RecommendationType, RecommendationSubType, TargetType, RecommendationStatus } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  initializeAll,
  getRecommendationCounts,
  getRecommendationsByType,
  skipRecommendation,
  archiveOrDelete,
  unskipRecommendation,
} from "../models/recommendation.server";
import { TAB_DEFINITIONS, getSubTypeDefinition } from "app/constants/recommendations";
import { getShopSettings } from "../models/settings.server";
import { getShopifyAdminUrl } from "../utils/url";
import { UpdateTitleModal } from "./app.reco.update-title";
import { UpdatePricingModal } from "./app.reco.update-pricing";
import { UpdateDescriptionModal } from "./app.reco.update-description";

type LoaderData = {
  shop: string;
  counts: Record<RecommendationType, number>;
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
    type: RecommendationType;
    data: Recommendation[];
    count: number;
    subTypes: {
      type: RecommendationSubType;
      label: string;
    }[];
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const size = Number(url.searchParams.get("size") ?? "10");
  const type = url.searchParams.get("type") as RecommendationType;
  const showSkipped = url.searchParams.get("showSkipped") === "true";

  const { session } = await authenticate.admin(request);
  const status = showSkipped ? [RecommendationStatus.PENDING, RecommendationStatus.IGNORED] : RecommendationStatus.PENDING;
  const [typeCounts, settings] = await Promise.all([
    getRecommendationCounts(request, status),
    getShopSettings(request)
  ]);

  let activeTab;
  if (type && TAB_DEFINITIONS[type]) {
    const data = await getRecommendationsByType(request, type, status, page, size);
    activeTab = {
      type,
      count: typeCounts[type] ?? 0,
      data,
      subTypes: TAB_DEFINITIONS[type].subTypes,
    };
  }

  return { shop: session.shop, counts: typeCounts, settings, activeTab };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { session } = await authenticate.admin(request);
  const action = formData.get('action');
  const showSkipped = formData.get('showSkipped') === 'true';
  const status = showSkipped ? [RecommendationStatus.PENDING, RecommendationStatus.IGNORED] : RecommendationStatus.PENDING;
  const recommendationId = formData.get('recommendationId') as string;

  switch (action) {
    case 'skip':
      await skipRecommendation(request, recommendationId);
      break;
    case 'unskip':
      await unskipRecommendation(request, recommendationId);
      break;
    case 'archive_delete':
      await archiveOrDelete(request, recommendationId);
      break;
    case 'initialize':
      await initializeAll(request);
      break;
    default:
      throw new Error(`Invalid action: ${action}`);
  }

  const counts = await getRecommendationCounts(request, status);
  return { shop: session.shop, counts };
}

const PAGE_SIZE = 10;

export default function Index() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTitleRecommendation, setSelectedTitleRecommendation] = useState<Recommendation | null>(null);
  const [selectedPricingRecommendation, setSelectedPricingRecommendation] = useState<Recommendation | null>(null);
  const [selectedDescriptionRecommendation, setSelectedDescriptionRecommendation] = useState<Recommendation | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const tabs = Object.entries(TAB_DEFINITIONS).map(([type, definition]) => {
    const count = (fetcher.data?.counts ?? data.counts)[type as RecommendationType] ?? 0;
    return {
      content: count > 0 ? `${definition.content} (${count})` : definition.content,
      id: type,
    };
  }).filter(tab => (fetcher.data?.counts ?? data.counts)[tab.id as RecommendationType] > 0);

  useEffect(() => {
    if (tabs.length > 0) {
      fetcher.load(`/app/reco?type=${tabs[selectedTab].id}&page=${page}&size=${PAGE_SIZE}&showSkipped=${showSkipped}`);
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
          onAction: () => fetcher.submit({ action: 'initialize' }, { method: "post" }),
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
    const subTypeLabel = getSubTypeDefinition(recommendation.subType);
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
          <Badge icon={subTypeLabel.icon} tone={subTypeLabel.tone}>
            {subTypeLabel.label}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {createdAt.toLocaleDateString()}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <ButtonGroup>
            {recommendation.type === RecommendationType.PRICING && (
              <Button
                onClick={() => setSelectedPricingRecommendation({ ...recommendation, createdAt, updatedAt })}
              >
                Update Pricing
              </Button>
            )}
            {recommendation.type === RecommendationType.DEFINITION && (
              <>
                {(recommendation.subType === RecommendationSubType.SHORT_TITLE ||
                  recommendation.subType === RecommendationSubType.LONG_TITLE) && (
                  <Button onClick={() => setSelectedTitleRecommendation({ ...recommendation, createdAt, updatedAt })}>
                    Edit Title
                  </Button>
                )}
                {(recommendation.subType === RecommendationSubType.SHORT_DESCRIPTION ||
                  recommendation.subType === RecommendationSubType.LONG_DESCRIPTION) && (
                  <Button onClick={() => setSelectedDescriptionRecommendation({ ...recommendation, createdAt, updatedAt })}>
                    Edit Description
                  </Button>
                )}
              </>
            )}
            {recommendation.type === RecommendationType.STOCK &&
              recommendation.subType === RecommendationSubType.NO_STOCK && (
              <Button
                tone="critical"
                onClick={() => {
                  fetcher.submit(
                    {
                      action: 'archive_delete',
                      recommendationId: recommendation.id,
                    },
                    { method: 'post' }
                  );
                }}
              >
                {recommendation.targetType === TargetType.PRODUCT ? 'Archive Product' : 'Delete Variant'}
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
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const handleTabChange = (selectedTabIndex: number) => {
    setSelectedTab(selectedTabIndex);
    setPage(1);
    fetcher.load(`/app/reco?type=${tabs[selectedTabIndex].id}&page=1&size=${PAGE_SIZE}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetcher.load(`/app/reco?type=${tabs[selectedTab].id}&page=${newPage}&size=${PAGE_SIZE}`);
  };

  return (
    <Page
      title="Recommendations"
      primaryAction={{
        content: "Initialize",
        onAction: () => fetcher.submit({ action: 'initialize' }, { method: "post" }),
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
      <UpdatePricingModal
        recommendation={selectedPricingRecommendation}
        settings={data.settings}
        onClose={() => setSelectedPricingRecommendation(null)}
      />
      <UpdateDescriptionModal
        recommendation={selectedDescriptionRecommendation}
        settings={data.settings}
        onClose={() => setSelectedDescriptionRecommendation(null)}
      />
      <IndexTable
        resourceName={resourceName}
        itemCount={totalCount}
        headings={[
          { title: "Title" },
          { title: "Issue" },
          { title: "Date Created" },
          { title: "Actions" },
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
