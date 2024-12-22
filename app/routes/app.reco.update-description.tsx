import { Modal, Banner, TextField, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { updateDescription } from "../models/product.server";

interface UpdateDescriptionModalProps {
  recommendation: Recommendation | null;
  settings: {
    shortDescriptionLength: number;
    longDescriptionLength: number;
  };
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const newDescription = formData.get('newDescription') as string;

  await updateDescription(request, recommendationId, newDescription);
  return { success: true };
}

export function UpdateDescriptionModal({ recommendation, settings, onClose }: UpdateDescriptionModalProps) {
  const fetcher = useFetcher<typeof action>();
  const [newDescription, setNewDescription] = useState('');
  const [updateError, setUpdateError] = useState('');
  const isDescriptionValid = newDescription.length >= settings.shortDescriptionLength &&
    newDescription.length <= settings.longDescriptionLength;

  useEffect(() => {
    if (recommendation) {
      setNewDescription(recommendation.targetDescription ?? '');
    }
  }, [recommendation]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onClose();
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <Modal
      open={recommendation !== null}
      onClose={onClose}
      title="Update Product Description"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          setUpdateError('');
          fetcher.submit(
            {
              recommendationId: recommendation?.id ?? '',
              newDescription,
            },
            { method: 'post' }
          );
        },
        loading: fetcher.state === 'submitting',
        disabled: !isDescriptionValid,
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
            Current Description: {recommendation?.targetDescription}
          </Text>
          <TextField
            label="New Description"
            value={newDescription}
            onChange={setNewDescription}
            autoComplete="off"
            multiline={4}
            error={
              newDescription.length < settings.shortDescriptionLength
                ? `Description must be at least ${settings.shortDescriptionLength} characters`
                : newDescription.length > settings.longDescriptionLength
                ? `Description must not exceed ${settings.longDescriptionLength} characters`
                : undefined
            }
            helpText={
              isDescriptionValid
                ? `Description length should be between ${settings.shortDescriptionLength} and ${settings.longDescriptionLength} characters`
                : undefined
            }
            showCharacterCount
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
