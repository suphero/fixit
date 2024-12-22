import { Modal, Banner, TextField, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { getDetails, updatePricing } from "../models/variant.server";

interface UpdatePricingModalProps {
  recommendation: Recommendation | null;
  settings: {
    minRevenueRate: number;
    maxRevenueRate: number;
    lowDiscountRate: number;
    highDiscountRate: number;
  };
  onClose: () => void;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const variantId = url.searchParams.get('variantId');
  if (!variantId) return null;
  return getDetails(request, variantId);
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const cost = formData.get('cost') as string;
  const price = formData.get('price') as string;
  const compareAtPrice = formData.get('compareAtPrice') as string;

  await updatePricing(request, recommendationId, {
    cost: Number(cost),
    price: Number(price),
    compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
  });
  return { success: true };
}

export function UpdatePricingModal({ recommendation, settings, onClose }: UpdatePricingModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const detailsFetcher = useFetcher<typeof loader>();
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    if (recommendation?.variantId) {
      detailsFetcher.load(`/app/reco/update-pricing?variantId=${recommendation.variantId}`);
    }
  }, [recommendation]);

  useEffect(() => {
    if (detailsFetcher.data) {
      setCost(detailsFetcher.data.cost.toString());
      setPrice(detailsFetcher.data.currentPrice.toString());
      if (detailsFetcher.data.currentCompareAtPrice) {
        setCompareAtPrice(detailsFetcher.data.currentCompareAtPrice.toString());
      }
    }
  }, [detailsFetcher.data]);

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      onClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const costValue = Number(cost);
  const priceValue = Number(price);
  const compareAtPriceValue = compareAtPrice ? Number(compareAtPrice) : undefined;

  const minPrice = costValue * (1 + settings.minRevenueRate);
  const maxPrice = costValue * (1 + settings.maxRevenueRate);

  const getErrors = () => {
    if (costValue <= 0) return "Cost must be greater than 0";
    if (priceValue <= 0) return "Price must be greater than 0";
    if (priceValue < costValue) return "Price cannot be lower than cost";
    if (priceValue < minPrice) return `Price must be at least ${minPrice.toFixed(2)} for ${settings.minRevenueRate * 100}% revenue`;
    if (priceValue > maxPrice) return `Price must not exceed ${maxPrice.toFixed(2)} for ${settings.maxRevenueRate * 100}% revenue`;

    if (compareAtPriceValue) {
      if (compareAtPriceValue <= priceValue) return "Compare at price must be greater than price";
      const discountPercentage = ((compareAtPriceValue - priceValue) / compareAtPriceValue) * 100;
      if (discountPercentage < settings.lowDiscountRate * 100) return `Discount must be at least ${settings.lowDiscountRate * 100}%`;
      if (discountPercentage > settings.highDiscountRate * 100) return `Discount cannot exceed ${settings.highDiscountRate * 100}%`;
    }

    return undefined;
  };

  const error = getErrors();

  return (
    <Modal
      open={recommendation !== null}
      onClose={onClose}
      title="Update Pricing"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          setUpdateError('');
          submitFetcher.submit(
            {
              recommendationId: recommendation?.id ?? '',
              cost,
              price,
              compareAtPrice,
            },
            { method: 'post' }
          );
        },
        loading: submitFetcher.state === 'submitting',
        disabled: !!error,
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
          <TextField
            label="Cost"
            type="number"
            prefix="$"
            value={cost}
            onChange={setCost}
            autoComplete="off"
            required
          />
          <TextField
            label="Price"
            type="number"
            prefix="$"
            value={price}
            onChange={setPrice}
            autoComplete="off"
            required
            error={error}
          />
          <TextField
            label="Compare at Price"
            type="number"
            prefix="$"
            value={compareAtPrice}
            onChange={setCompareAtPrice}
            autoComplete="off"
            helpText="Optional. Used for showing discounts."
          />
          {!error && compareAtPriceValue && (
            <Text as="p">
              Discount: {(((compareAtPriceValue - priceValue) / compareAtPriceValue) * 100).toFixed(1)}%
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
