import { useState, useEffect } from "react";
import {
  Page,
  IndexTable,
  IndexFilters,
  Text,
  useSetIndexFiltersMode,
  Button,
  ButtonGroup,
  Badge,
  Tooltip,
} from "@shopify/polaris";
import {
  ProductIcon,
  VariantIcon,
} from "@shopify/polaris-icons";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import type { Recommendation, RecommendationSubType, RecommendationType } from "@prisma/client";
import { authenticate } from "../shopify.server";
import {
  getRecommendationCounts,
  getRecommendationsByType,
} from "../models/recommendation.server";
import { TAB_DEFINITIONS, getSubTypeDefinition } from "../constants/recommendations";
import { getShopSettings } from "../models/settings.server";
import { getShopifyAdminUrl } from "../utils/url";
import { UpdateTextModal } from "./app.reco.update-text";
import { UpdateMediaModal } from "./app.reco.update-media";
import { UpdatePricingModal } from "./app.reco.update-pricing";

type LoaderData = {
  shop: string;
  shopData: {
    currencyCode: string;
    moneyFormat: string;
  };
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

const PAGE_SIZE = 10;

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const size = Math.max(1, Number(url.searchParams.get("size") ?? PAGE_SIZE));
  const type = url.searchParams.get("type") as RecommendationType;

  const { admin, session } = await authenticate.admin(request);

  // Fetch shop data
  const response = await admin.graphql(
    `#graphql
    query getShop {
      shop {
        currencyCode
        currencyFormats {
          moneyFormat
          moneyWithCurrencyFormat
        }
      }
    }`
  );
  const { data } = await response.json();

  const [typeCounts, settings] = await Promise.all([
    getRecommendationCounts(request, "PENDING"),
    getShopSettings(request),
  ]);

  let activeTab = null;
  if (type && TAB_DEFINITIONS[type]) {
    const data = await getRecommendationsByType(request, type, "PENDING", page, size);
    activeTab = {
      type,
      count: typeCounts[type] ?? 0,
      data,
      subTypes: TAB_DEFINITIONS[type].subTypes,
    };
  }

  return {
    shop: session.shop,
    shopData: {
      currencyCode: data.shop.currencyCode,
      moneyFormat: data.shop.currencyFormats.moneyFormat,
    },
    counts: typeCounts,
    settings,
    activeTab
  };
}

export default function Index() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPricingRecommendation, setSelectedPricingRecommendation] = useState<Recommendation | null>(null);
  const [selectedTextRecommendation, setSelectedTextRecommendation] = useState<Recommendation | null>(null);
  const [selectedMediaRecommendation, setSelectedMediaRecommendation] = useState<Recommendation | null>(null);

  const tabs = Object.entries(TAB_DEFINITIONS)
    .map(([type, definition]) => ({
      content: `${definition.content} (${data.counts[type as RecommendationType] ?? 0})`,
      id: type,
    }))
    .filter((tab) => (data.counts[tab.id as RecommendationType] ?? 0) > 0);

  useEffect(() => {
    if (!fetcher.data?.activeTab && tabs.length > 0) {
      fetcher.load(`/app/reco?type=${tabs[selectedTab].id}&page=${page}&size=${PAGE_SIZE}`);
    }
  }, [tabs.length, selectedTab, page]);

  const activeTabData = fetcher.data?.activeTab ?? data.activeTab;
  const recommendations: Recommendation[] = activeTabData?.data ?? [];
  const totalCount = activeTabData?.count ?? 0;
  const isLoading = fetcher.state !== "idle";

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    setPage(1);
    fetcher.load(`/app/reco?type=${tabs[index].id}&page=1&size=${PAGE_SIZE}`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetcher.load(`/app/reco?type=${tabs[selectedTab].id}&page=${newPage}&size=${PAGE_SIZE}`);
  };

  const truncate = (str: string, length = 50) =>
    str?.length > length ? str.slice(0, length) + "…" : str || "";

  const paginationLabel = `Page ${page} of ${Math.ceil(totalCount / PAGE_SIZE)} | Showing ${
    recommendations.length
  } of ${totalCount} items`;

  const rowMarkup = recommendations.map((recommendation, index) => (
    <IndexTable.Row id={recommendation.id} key={recommendation.id} position={index}>
      <IndexTable.Cell>
      <Tooltip content={recommendation.targetTitle}>
        <Button
          variant="plain"
          onClick={() => window.open(getShopifyAdminUrl(data.shop, recommendation.targetUrl), "_blank")}
        >
          {truncate(recommendation.targetTitle, 50)}
        </Button>
      </Tooltip>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          icon={recommendation.targetType === "PRODUCT" ? ProductIcon : VariantIcon}
          tone="info"
        >
          {recommendation.targetType === "PRODUCT" ? "Product" : "Variant"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <ButtonGroup>
        {recommendation.subTypes.map((subType) => {
          const subTypeDef = getSubTypeDefinition(subType);
          return (
            <Badge key={subType} icon={subTypeDef.icon} tone={subTypeDef.tone}>
              {subTypeDef.label}
            </Badge>
          );
        })}
        </ButtonGroup>
      </IndexTable.Cell>
      <IndexTable.Cell>{new Date(recommendation.createdAt).toLocaleDateString()}</IndexTable.Cell>
      <IndexTable.Cell>
        <ButtonGroup>
          {recommendation.type === "PRICING" && (
            <Button onClick={() => setSelectedPricingRecommendation(recommendation)} variant="primary">Fix</Button>
          )}
          {recommendation.type === "TEXT" && (
            <Button onClick={() => setSelectedTextRecommendation(recommendation)} variant="primary">Fix</Button>
          )}
          {recommendation.type === "MEDIA" && (
            <Button onClick={() => setSelectedMediaRecommendation(recommendation)} variant="primary">Fix</Button>
          )}
        </ButtonGroup>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  if (tabs.length === 0) {
    return (
      <Page title="Recommendations">
        <Text as="span">No recommendations available.</Text>
      </Page>
    );
  }

  return (
    <Page title="Recommendations">
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
      <UpdateTextModal
        recommendation={selectedTextRecommendation}
        settings={data.settings}
        onClose={() => setSelectedTextRecommendation(null)}
      />
      <UpdateMediaModal
        recommendation={selectedMediaRecommendation}
        onClose={() => setSelectedMediaRecommendation(null)}
      />
      <UpdatePricingModal
        recommendation={selectedPricingRecommendation}
        settings={data.settings}
        shopData={data.shopData}
        onClose={() => setSelectedPricingRecommendation(null)}
      />
      <IndexTable
        resourceName={{ singular: "Recommendation", plural: "Recommendations" }}
        itemCount={totalCount}
        headings={[
          { title: "Title" },
          { title: "Target" },
          { title: "Issue" },
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
          label: paginationLabel,
        }}
      >
        {rowMarkup}
      </IndexTable>
    </Page>
  );
}
