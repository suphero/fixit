import { Modal, TextField, BlockStack, Text, Banner } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { updateStock } from "../models/recommendation.server";
import { getSalesMetrics, getDetails } from "../models/variant.server";
import { getShop } from "../models/shop.server";
import { getShopSettings } from "../models/settings.server";

interface UpdateStockModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantId = url.searchParams.get('variantId');

  if (!variantId) {
    return { metrics: null, settings: null, isPremium: false, currentInventory: null };
  }

  const [shop, settings, variantDetails] = await Promise.all([
    getShop(request),
    getShopSettings(request),
    getDetails(request, variantId)
  ]);

  const isPremium = shop.subscriptionName !== 'Free';
  const metrics = isPremium ? await getSalesMetrics(request, variantId) : null;

  return {
    metrics,
    settings,
    isPremium,
    currentInventory: variantDetails.inventoryQuantity
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const quantity = Number(formData.get('quantity'));

  await updateStock(request, {
    id: recommendationId,
    quantity,
  });
  return { success: true };
}

export function UpdateStockModal({ recommendation, onClose }: UpdateStockModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const metricsFetcher = useFetcher<typeof loader>();
  const [quantity, setQuantity] = useState('0');

  useEffect(() => {
    if (recommendation?.variantId) {
      metricsFetcher.load(`/app/reco/update-stock?variantId=${recommendation.variantId}`);
    }
  }, [recommendation?.variantId]);

  // Set initial quantity when data is loaded
  useEffect(() => {
    if (metricsFetcher.data?.currentInventory !== null) {
      setQuantity(String(metricsFetcher?.data?.currentInventory ?? 0));
    }
  }, [metricsFetcher.data?.currentInventory]);

  const handleClose = () => {
    setQuantity('0');
    onClose();
  };

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const isValid = Number(quantity) >= 0;
  const metrics = metricsFetcher.data?.metrics;
  const settings = metricsFetcher.data?.settings;
  const isPremium = metricsFetcher.data?.isPremium;
  const currentInventory = metricsFetcher.data?.currentInventory;

  let suggestedQuantity = null;
  let suggestion = null;

  if (isPremium && metrics && settings && recommendation?.type === 'STOCK') {
    const now = new Date();
    const daysSinceLastOrder = metrics.lastOrderDate
      ? Math.floor((now.getTime() - new Date(metrics.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Only suggest for active items
    if (daysSinceLastOrder <= settings.passiveDays) {
      const daysOfStock = currentInventory / metrics.averageDailySales;

      if (daysOfStock < settings.understockDays) {
        const targetDays = Math.ceil((settings.understockDays + settings.overstockDays) / 2);
        suggestedQuantity = Math.ceil(metrics.averageDailySales * targetDays - currentInventory);
        suggestion = 'UNDERSTOCK';
      } else if (daysOfStock > settings.overstockDays) {
        const targetDays = Math.ceil((settings.understockDays + settings.overstockDays) / 2);
        suggestedQuantity = Math.ceil(metrics.averageDailySales * targetDays - currentInventory);
        suggestion = 'OVERSTOCK';
      }
    }
  }

  return (
    <Modal
      open={recommendation !== null}
      onClose={handleClose}
      title="Update Stock"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          if (!recommendation) {
            throw new Error('Recommendation is required');
          }
          const formData = new FormData();
          formData.append('recommendationId', recommendation.id);
          formData.append('quantity', quantity);

          submitFetcher.submit(formData, {
            method: 'post',
            action: '/app/reco/update-stock'
          });
        },
        loading: submitFetcher.state === 'submitting',
        disabled: !isValid,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: handleClose,
          disabled: submitFetcher.state === 'submitting',
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {isPremium && metrics && (
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">Current Metrics</Text>
              <Text as="p">Average Daily Sales: {metrics.averageDailySales.toFixed(2)} units</Text>
              <Text as="p">Current Inventory: {currentInventory} units</Text>
              {metrics.lastOrderDate && (
                <Text as="p">Last Order: {new Date(metrics.lastOrderDate).toLocaleDateString()}</Text>
              )}
              {suggestedQuantity !== null && (
                <Banner
                  title={`Suggested ${suggestion === 'UNDERSTOCK' ? 'Increase' : 'Decrease'}`}
                  tone={suggestion === 'UNDERSTOCK' ? 'warning' : 'info'}
                >
                  <Text as="p">
                    Suggested adjustment: {Math.abs(suggestedQuantity)} units
                    ({suggestion === 'UNDERSTOCK' ? 'add' : 'remove'})
                  </Text>
                </Banner>
              )}
            </BlockStack>
          )}
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={setQuantity}
            autoComplete="off"
            min={0}
            helpText="Enter the total inventory quantity"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
