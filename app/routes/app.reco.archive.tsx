import { Modal, Text, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { archiveProduct, deleteVariant } from "../models/recommendation.server";

interface ArchiveModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const targetType = formData.get('targetType') as string;

  if (targetType === "PRODUCT") {
    await archiveProduct(request, recommendationId);
  } else {
    await deleteVariant(request, recommendationId);
  }

  return { success: true };
}

export function ArchiveModal({ recommendation, onClose }: ArchiveModalProps) {
  const submitFetcher = useFetcher<typeof action>();

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const isProduct = recommendation?.targetType === "PRODUCT";
  const actionText = isProduct ? "Archive Product" : "Delete Variant";

  return (
    <Modal
      open={recommendation !== null}
      onClose={handleClose}
      title={actionText}
      primaryAction={{
        content: actionText,
        onAction: () => {
          if (!recommendation) {
            throw new Error('Recommendation is required');
          }
          const formData = new FormData();
          formData.append('recommendationId', recommendation.id);
          formData.append('targetId', isProduct ? recommendation.productId! : recommendation.variantId!);
          formData.append('targetType', recommendation.targetType);

          submitFetcher.submit(formData, {
            method: 'post',
            action: '/app/reco/archive'
          });
        },
        loading: submitFetcher.state === 'submitting',
        destructive: true,
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
          <Text as="p">
            Are you sure you want to {isProduct ? "archive this product?" : "delete this variant? This action cannot be undone."}
          </Text>
          <Text as="p" tone="subdued">
            Target: {recommendation?.targetTitle}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
