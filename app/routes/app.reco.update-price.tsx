import { Modal, Banner, TextField, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { getDetails, updatePrice } from "../models/variant.server";

interface UpdatePriceModalProps {
  recommendation: Recommendation | null;
  settings: {
    minRevenueRate: number;
    maxRevenueRate: number;
  };
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const newPrice = formData.get('newPrice') as string;

  await updatePrice(request, recommendationId, Number(newPrice));
  return { success: true };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantId = url.searchParams.get('variantId');
  if (!variantId) return null;
  return getDetails(request, variantId);
}

const getPriceErrorMessage = (price: number, minPrice: number, maxPrice: number, minRevenue: string, maxRevenue: string) => {
  if (price < minPrice) {
    return `Price must be at least ${minPrice} for ${minRevenue}% revenue`;
  }
  if (price > maxPrice) {
    return `Price must not exceed ${maxPrice} for ${maxRevenue}% revenue`;
  }
  return undefined;
};

export function UpdatePriceModal({ recommendation, settings, onClose }: UpdatePriceModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const detailsFetcher = useFetcher<typeof loader>();
  const [newPrice, setNewPrice] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (recommendation) {
      detailsFetcher.load(`/app/reco/update-price?variantId=${recommendation.variantId}`);
    }
  }, [recommendation]);

  useEffect(() => {
    if (detailsFetcher.data) {
      setNewPrice(detailsFetcher.data.currentPrice.toString());
    }
  }, [detailsFetcher.data]);

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      onClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  if (!detailsFetcher.data) return null;

  const { cost, minPrice, maxPrice, currentPrice } = detailsFetcher.data;
  const minRevenue = (settings.minRevenueRate * 100).toFixed(0);
  const maxRevenue = (settings.maxRevenueRate * 100).toFixed(0);

  return (
    <Modal
      open={recommendation !== null}
      onClose={onClose}
      title="Update Product Price"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          setUpdateError('');
          submitFetcher.submit(
            {
              recommendationId: recommendation?.id ?? '',
              newPrice,
            },
            {
              method: 'post',
              action: '/app/reco/update-price'
            }
          );
        },
        loading: submitFetcher.state === 'submitting',
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        {updateError && (
          <Banner tone="critical">
            {updateError}
          </Banner>
        )}
        <BlockStack gap="400">
          <Text as="p">
            Product Cost: ${cost.toFixed(2)}
          </Text>
          <Text as="p">
            Current Price: ${currentPrice.toFixed(2)}
          </Text>
          <TextField
            label="New Price"
            type="number"
            prefix="$"
            value={newPrice}
            onChange={setNewPrice}
            autoComplete="off"
            error={getPriceErrorMessage(Number(newPrice), minPrice, maxPrice, minRevenue, maxRevenue)}
            helpText={
              Number(newPrice) >= minPrice && Number(newPrice) <= maxPrice
                ? `Price should be between ${minPrice} and ${maxPrice} for ${minRevenue}% and ${maxRevenue}% revenue`
                : undefined
            }
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
