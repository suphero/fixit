import { Modal, TextField, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { updateText } from "../models/recommendation.server";

interface UpdateTextModalProps {
  recommendation: Recommendation | null;
  settings: {
    shortTitleLength: number;
    longTitleLength: number;
    shortDescriptionLength: number;
    longDescriptionLength: number;
  };
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  await updateText(request, recommendationId, {
    title,
    descriptionHtml: description,
  });
  return { success: true };
}

export function UpdateTextModal({ recommendation, settings, onClose }: UpdateTextModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleClose = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  useEffect(() => {
    if (recommendation) {
      setTitle(recommendation.targetTitle);
      setDescription(recommendation.targetDescriptionHtml ?? '');
    }
  }, [recommendation]);

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const isTitleValid = title.length >= settings.shortTitleLength && title.length <= settings.longTitleLength;
  const isDescriptionValid = description.length >= settings.shortDescriptionLength && description.length <= settings.longDescriptionLength;

  const validationErrors = {
    title: !isTitleValid ?
      title.length < settings.shortTitleLength
        ? `Title must be at least ${settings.shortTitleLength} characters`
        : `Title must not exceed ${settings.longTitleLength} characters`
      : undefined,
    description: !isDescriptionValid ?
      description.length < settings.shortDescriptionLength
        ? `Description must be at least ${settings.shortDescriptionLength} characters`
        : `Description must not exceed ${settings.longDescriptionLength} characters`
      : undefined,
  };

  const isValid = isTitleValid && isDescriptionValid;

  return (
    <Modal
      open={recommendation !== null}
      onClose={handleClose}
      title="Update Text Content"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          if (!recommendation) {
            throw new Error('Recommendation is required');
          }
          const formData = new FormData();
          formData.append('recommendationId', recommendation.id);
          formData.append('title', title);
          formData.append('description', description);

          submitFetcher.submit(formData, { method: 'post' });
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
          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            error={validationErrors.title}
            helpText={isTitleValid && `Title length should be between ${settings.shortTitleLength} and ${settings.longTitleLength} characters`}
            showCharacterCount
          />

          <TextField
            label="Description"
            value={description}
            onChange={setDescription}
            autoComplete="off"
            multiline={4}
            error={validationErrors.description}
            helpText={isDescriptionValid && `Description length should be between ${settings.shortDescriptionLength} and ${settings.longDescriptionLength} characters`}
            showCharacterCount
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
