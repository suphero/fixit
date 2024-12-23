import { Modal, TextField, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { getDetails } from "../models/variant.server";
import { updatePricing } from "app/models/recommendation.server";

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
    cost,
    price,
    compareAtPrice,
  });
  return { success: true };
}

export function UpdatePricingModal({ recommendation, settings, onClose }: UpdatePricingModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const detailsFetcher = useFetcher<typeof loader>();
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');

  const handleClose = () => {
    setCost('');
    setPrice('');
    setCompareAtPrice('');
    onClose();
  };

  useEffect(() => {
    if (recommendation?.variantId) {
      detailsFetcher.load(`/app/reco/update-pricing?variantId=${recommendation.variantId}`);
    }
  }, [recommendation]);

  useEffect(() => {
    if (detailsFetcher.data) {
      setCost(detailsFetcher.data.cost);
      setPrice(detailsFetcher.data.currentPrice);
      if (detailsFetcher.data.currentCompareAtPrice) {
        setCompareAtPrice(detailsFetcher.data.currentCompareAtPrice);
      }
    }
  }, [detailsFetcher.data]);

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const costValue = cost ? Number(cost) : undefined;
  const priceValue = Number(price);
  const compareAtPriceValue = compareAtPrice ? Number(compareAtPrice) : undefined;

  const getErrors = () => {
    let costError, priceError, compareAtPriceError;
    let hasError = false;

    if (!costValue || costValue <= 0) {
      costError = "No Cost: Cost must be greater than 0";
      hasError = true;
    }

    if (priceValue <= 0) {
      priceError = "Free: Price must be greater than 0";
      hasError = true;
    }

    if (costValue) {
      if (priceValue < costValue) {
        priceError = "Sale at Loss: Price cannot be lower than cost";
        hasError = true;
      } else {
        const minPrice = costValue * (1 + settings.minRevenueRate);
        const maxPrice = costValue * (1 + settings.maxRevenueRate);

        if (priceValue < minPrice) {
          priceError = `Cheap: Price must be at least ${minPrice.toFixed(2)} for ${settings.minRevenueRate * 100}% revenue`;
          hasError = true;
        }

        if (priceValue > maxPrice) {
          priceError = `Expensive: Price must not exceed ${maxPrice.toFixed(2)} for ${settings.maxRevenueRate * 100}% revenue`;
          hasError = true;
        }
      }
    }

    if (compareAtPriceValue) {
      if (compareAtPriceValue <= priceValue) {
        compareAtPriceError = "No Discount: Compare at price must be greater than price";
        hasError = true;
      } else {
        const discountPercentage = ((compareAtPriceValue - priceValue) / compareAtPriceValue) * 100;
        if (discountPercentage < settings.lowDiscountRate * 100) {
          compareAtPriceError = `Low Discount: Discount must be at least ${settings.lowDiscountRate * 100}%, current: ${discountPercentage.toFixed(2)}%`;
          hasError = true;
        };
        if (discountPercentage > settings.highDiscountRate * 100) {
          compareAtPriceError = `High Discount: Discount cannot exceed ${settings.highDiscountRate * 100}%, current: ${discountPercentage.toFixed(2)}%`;
          hasError = true;
        };
      }
    }

    return { costError, priceError, compareAtPriceError, hasError };
  };

  const error = getErrors();

  const isLoading = detailsFetcher.state !== 'idle';

  return (
    <Modal
      open={recommendation !== null}
      onClose={handleClose}
      title="Update Pricing"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          if (!recommendation) {
            throw new Error('Recommendation is required');
          }
          submitFetcher.submit(
            {
              recommendationId: recommendation.id,
              cost,
              price,
              compareAtPrice,
            },
            { method: 'post' }
          );
        },
        loading: submitFetcher.state === 'submitting',
        disabled: error.hasError || isLoading,
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
          <TextField
            label="Price"
            type="number"
            prefix="$"
            value={price}
            onChange={setPrice}
            autoComplete="off"
            error={error.priceError}
            min={0}
            disabled={isLoading}
            loading={isLoading}
          />
          <TextField
            label="Cost per item"
            type="number"
            prefix="$"
            value={cost}
            onChange={setCost}
            autoComplete="off"
            error={error.costError}
            min={0}
            disabled={isLoading}
            loading={isLoading}
          />
          <TextField
            label="Compare-at price"
            type="number"
            prefix="$"
            value={compareAtPrice}
            onChange={setCompareAtPrice}
            autoComplete="off"
            helpText="Optional. Used for showing discounts."
            error={error.compareAtPriceError}
            min={0}
            disabled={isLoading}
            loading={isLoading}
          />
          {!error.hasError && compareAtPriceValue && !isLoading && (
            <Text as="p">
              Discount: {(((compareAtPriceValue - priceValue) / compareAtPriceValue) * 100).toFixed(1)}%
            </Text>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
