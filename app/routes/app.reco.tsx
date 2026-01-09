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
  Banner,
  BlockStack,
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
import { ArchiveModal } from "./app.reco.archive";
import { UpdateTextModal } from "./app.reco.update-text";
import { UpdateMediaModal } from "./app.reco.update-media";
import { UpdatePricingModal } from "./app.reco.update-pricing";
import { UpdateStockModal } from "./app.reco.update-stock";
import { getShop } from "../models/shop.server";
import type { RecommendationCount } from "../models/recommendation.business.server";
import { SHOPIFY_APP_HANDLE } from "../constants/config.server";
import {
  enrichRecommendationsWithImpact,
  calculateTotalImpact,
  type RecommendationWithImpact,
} from "../models/recommendation-impact.server";

type LoaderData = {
  shop: string;
  shopData: {
    currencyCode: string;
    moneyFormat: string;
  };
  counts: Record<RecommendationType, RecommendationCount>;
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
    data: RecommendationWithImpact[];
    count: number;
    subTypes: {
      type: RecommendationSubType;
      label: string;
    }[];
  };
  totalImpact?: {
    totalRevenue: number;
    positiveImpact: number;
    negativeImpact: number;
    averageScore: number;
    count: number;
  };
  isPremium: boolean;
  pricingPlanUrl: string;
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

  const [typeCounts, settings, shop] = await Promise.all([
    getRecommendationCounts(request, "PENDING"),
    getShopSettings(request),
    getShop(request)
  ]);

  const shopId = shop.shop.replace(".myshopify.com", "");
  const isPremium = shop.subscriptionName !== 'Free';
  const pricingPlanUrl = `https://admin.shopify.com/store/${shopId}/charges/${SHOPIFY_APP_HANDLE}/pricing_plans`;

  let activeTab = null;
  let totalImpact = null;

  if (type && TAB_DEFINITIONS[type]) {
    const recommendations = await getRecommendationsByType(request, type, "PENDING", page, size);
    // Filter out premium recommendations for non-premium users
    const filteredData = isPremium ? recommendations : recommendations.filter(r => !r.premium);

    // Enrich recommendations with impact data
    const enrichedData = await enrichRecommendationsWithImpact(
      admin,
      session.shop,
      filteredData,
      settings,
    );

    // Calculate total impact for current page
    totalImpact = calculateTotalImpact(enrichedData);

    activeTab = {
      type,
      count: isPremium ? typeCounts[type].all : typeCounts[type].free,
      data: enrichedData,
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
    activeTab,
    totalImpact,
    isPremium,
    pricingPlanUrl,
  };
}

export default function Recommendations() {
  const fetcher = useFetcher<LoaderData>();
  const data = useLoaderData<LoaderData>();
  const { mode, setMode } = useSetIndexFiltersMode();
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedPricingRecommendation, setSelectedPricingRecommendation] = useState<Recommendation | null>(null);
  const [selectedTextRecommendation, setSelectedTextRecommendation] = useState<Recommendation | null>(null);
  const [selectedMediaRecommendation, setSelectedMediaRecommendation] = useState<Recommendation | null>(null);
  const [selectedStockRecommendation, setSelectedStockRecommendation] = useState<Recommendation | null>(null);
  const [selectedArchiveRecommendation, setSelectedArchiveRecommendation] = useState<Recommendation | null>(null);

  const tabs = Object.entries(TAB_DEFINITIONS)
    .map(([type, definition]) => ({
      content: `${definition.content} (${
        data.isPremium
          ? data.counts[type as RecommendationType].all
          : data.counts[type as RecommendationType].free
      })`,
      id: type,
    }))
    .filter((tab) => {
      const count = data.isPremium
        ? data.counts[tab.id as RecommendationType].all
        : data.counts[tab.id as RecommendationType].free;
      return count > 0;
    });

  useEffect(() => {
    if (!fetcher.data?.activeTab && tabs.length > 0) {
      fetcher.load(`/app/reco?type=${tabs[selectedTab].id}&page=${page}&size=${PAGE_SIZE}`);
    }
  }, [tabs.length, selectedTab, page]);

  const activeTabData = fetcher.data?.activeTab ?? data.activeTab;
  const recommendations: RecommendationWithImpact[] = activeTabData?.data ?? [];
  const totalCount = activeTabData?.count ?? 0;
  const totalImpact = fetcher.data?.totalImpact ?? data.totalImpact;
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

  const formatCurrency = (amount: number) => {
    return data.shopData.moneyFormat
      .replace("{{amount}}", amount.toFixed(2))
      .replace("{{amount_no_decimals}}", Math.round(amount).toString());
  };

  const paginationLabel = `Page ${page} of ${Math.ceil(totalCount / PAGE_SIZE)} | Showing ${
    recommendations.length
  } of ${totalCount} items`;

  const rowMarkup = recommendations.map((recommendation, index) => {
    const impactScore = recommendation.impact.score;
    const impactTone = impactScore >= 80 ? "critical" : impactScore >= 60 ? "warning" : impactScore >= 40 ? "info" : "info";
    const impactIcon = recommendation.impact.impactType === "negative" ? "⚠️" : recommendation.impact.impactType === "positive" ? "📈" : "ℹ️";

    return (
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
        <IndexTable.Cell>
          <Tooltip content={`${recommendation.impact.calculation}\nConfidence: ${recommendation.impact.confidence}`}>
            <Badge tone={impactTone}>
              {impactIcon} {impactScore}/100
            </Badge>
          </Tooltip>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Tooltip content={recommendation.impact.assumptions.join("\n")}>
            <Text as="span" fontWeight="semibold">
              {formatCurrency(recommendation.impact.potentialRevenue)}/mo
            </Text>
          </Tooltip>
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
            {recommendation.type === "STOCK" && (() => {
              if (recommendation.subTypes.includes("PASSIVE")) {
                if (recommendation.targetType === "PRODUCT") {
                  return <Button onClick={() => setSelectedArchiveRecommendation(recommendation)} variant="primary">Archive</Button>;
                } else {
                  return <Button onClick={() => setSelectedArchiveRecommendation(recommendation)} variant="primary">Delete</Button>;
                }
              } else {
                return <Button onClick={() => setSelectedStockRecommendation(recommendation)} variant="primary">Fix</Button>;
              }
            })()}
          </ButtonGroup>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  if (tabs.length === 0) {
    return (
      <Page title="Recommendations">
        <Text as="span">No recommendations available.</Text>
      </Page>
    );
  }

  return (
    <Page title="Recommendations">
      {totalImpact && totalImpact.count > 0 && (
        <Banner
          title={`💰 Potential Revenue Impact: ${formatCurrency(totalImpact.totalRevenue)}/month`}
          tone="success"
        >
          <BlockStack gap="200">
            <Text as="p">
              Fixing these {totalImpact.count} recommendations on this page could impact your revenue by approximately{" "}
              <Text as="span" fontWeight="bold">{formatCurrency(totalImpact.totalRevenue)}</Text> per month.
            </Text>
            <Text as="p" tone="subdued">
              {totalImpact.positiveImpact > 0 && `📈 Potential gains: ${formatCurrency(totalImpact.positiveImpact)}/mo`}
              {totalImpact.positiveImpact > 0 && totalImpact.negativeImpact > 0 && " | "}
              {totalImpact.negativeImpact > 0 && `⚠️ Preventing losses: ${formatCurrency(totalImpact.negativeImpact)}/mo`}
            </Text>
          </BlockStack>
        </Banner>
      )}
      {!data.isPremium && Object.values(data.counts).some(count => count.premium > 0) && (
        <Banner
          title="Premium Recommendations Available"
          tone="warning"
          action={{
            content: 'Upgrade to Premium',
            onAction: () => {
              window?.top?.location.replace(data.pricingPlanUrl);
            },
          }}
        >
          <BlockStack gap="200">
            <Text as="p">
              You have {Object.values(data.counts).reduce((sum, count) => sum + count.premium, 0)} premium recommendations available.
              Upgrade to premium to access advanced recommendations and improve your store's performance.
            </Text>
          </BlockStack>
        </Banner>
      )}
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
      <UpdateStockModal
        recommendation={selectedStockRecommendation}
        onClose={() => setSelectedStockRecommendation(null)}
      />
      <ArchiveModal
        recommendation={selectedArchiveRecommendation}
        onClose={() => setSelectedArchiveRecommendation(null)}
      />
      <IndexTable
        resourceName={{ singular: "Recommendation", plural: "Recommendations" }}
        itemCount={totalCount}
        headings={[
          { title: "Title" },
          { title: "Target" },
          { title: "Issue" },
          { title: "Impact" },
          { title: "Potential Revenue" },
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
