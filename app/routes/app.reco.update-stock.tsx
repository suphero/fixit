import { Modal, TextField, BlockStack, Text } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { updateStock } from "../models/recommendation.server";
import { getSalesMetrics, getDetails } from "../models/variant.server";
import { getShopSettings } from "../models/settings.server";

interface UpdateStockModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantId = url.searchParams.get('variantId');

  if (!variantId) {
    return { metrics: null, settings: null, currentInventory: null };
  }

  const [settings, variantDetails] = await Promise.all([
    getShopSettings(request),
    getDetails(request, variantId)
  ]);

  const metrics = await getSalesMetrics(request, variantId);

  return {
    metrics,
    settings,
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

  const metrics = metricsFetcher.data?.metrics;
  const settings = metricsFetcher.data?.settings;
  const currentInventory = metricsFetcher.data?.currentInventory;

  const getStockError = (value: number): string | undefined => {
    if (value === 0) return "Stock cannot be zero";

    if (!metrics || !settings) return;

    const daysOfStock = value / metrics.averageDailySales;

    if (daysOfStock < settings.understockDays) {
      return `Stock level too low. Need at least ${Math.ceil(metrics.averageDailySales * settings.understockDays)} units for ${settings.understockDays} days of stock`;
    }

    if (daysOfStock > settings.overstockDays) {
      return `Stock level too high. Need at most ${Math.floor(metrics.averageDailySales * settings.overstockDays)} units for ${settings.overstockDays} days of stock`;
    }
  };

  const stockError = getStockError(Number(quantity));
  const isValid = Number(quantity) > 0 && !stockError;

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
          {metrics && (
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">Current Metrics</Text>
              <Text as="p">Average Daily Sales: {metrics.averageDailySales.toFixed(2)} units</Text>
              <Text as="p">Current Inventory: {currentInventory} units</Text>
              {metrics.lastOrderDate && (
                <Text as="p">Last Order: {new Date(metrics.lastOrderDate).toLocaleDateString()}</Text>
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
            error={stockError}
            helpText="Enter the total inventory quantity"
          />
          {metrics && settings && (
            <Text as="p" tone="subdued">
              Stock should cover between {settings.understockDays} and {settings.overstockDays} days
              ({Math.ceil(metrics.averageDailySales * settings.understockDays)} - {Math.floor(metrics.averageDailySales * settings.overstockDays)} units)
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
