import { Modal, Banner, TextField, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { updateTitle } from "../models/recommendation.server";

interface UpdateTitleModalProps {
  recommendation: Recommendation | null;
  settings: {
    shortTitleLength: number;
    longTitleLength: number;
  };
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const newTitle = formData.get('newTitle') as string;

  await updateTitle(request, recommendationId, newTitle);
  return { success: true };
}

export function UpdateTitleModal({ recommendation, settings, onClose }: UpdateTitleModalProps) {
  const fetcher = useFetcher<typeof action>();
  const [newTitle, setNewTitle] = useState('');
  const [updateError, setUpdateError] = useState('');
  const isTitleValid = newTitle.length >= settings.shortTitleLength && newTitle.length <= settings.longTitleLength;
  useEffect(() => {
    setNewTitle(recommendation?.targetTitle ?? '');
  }, [recommendation]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.success) {
      onClose();
    }
  }, [fetcher.state, fetcher.data]);

  const handleUpdateTitle = () => {
    if (!recommendation) {
      throw new Error('Recommendation is required');
    }
    setUpdateError('');
    fetcher.submit(
      {
        recommendationId: recommendation.id,
        newTitle,
      },
      {
        method: 'post',
        action: '/app/reco/update-title'
      }
    );
  };

  const getErrorMessage = (length: number, settings: { shortTitleLength: number; longTitleLength: number }) => {
    if (length < settings.shortTitleLength) {
      return `Title must be at least ${settings.shortTitleLength} characters`;
    }
    if (length > settings.longTitleLength) {
      return `Title must not exceed ${settings.longTitleLength} characters`;
    }
    return undefined;
  };

  return (
    <Modal
      open={recommendation !== null}
      onClose={onClose}
      title="Update Product Title"
      primaryAction={{
        content: 'Update',
        onAction: handleUpdateTitle,
        loading: fetcher.state === 'submitting',
        disabled: !isTitleValid,
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
            Current Title: {recommendation?.targetTitle}
          </Text>
          <TextField
            label="New Title"
            value={newTitle}
            onChange={setNewTitle}
            autoComplete="off"
            error={getErrorMessage(newTitle.length, settings)}
            helpText={
              isTitleValid
                ? `Title length should be between ${settings.shortTitleLength} and ${settings.longTitleLength} characters`
                : undefined
            }
            showCharacterCount
            multiline
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
