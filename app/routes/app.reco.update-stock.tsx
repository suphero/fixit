import { Modal, TextField, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { updateStock } from "../models/recommendation.server";

interface UpdateStockModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
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
  const [quantity, setQuantity] = useState('0');

  const handleClose = () => {
    setQuantity('0');
    onClose();
  };

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const isValid = Number(quantity) > 0;

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
          <TextField
            label="Quantity"
            type="number"
            value={quantity}
            onChange={setQuantity}
            autoComplete="off"
            min={0}
            helpText="Enter the quantity to add to inventory"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
