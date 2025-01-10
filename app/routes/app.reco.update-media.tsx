import { Modal, DropZone, Thumbnail, BlockStack } from "@shopify/polaris";
import type { Recommendation } from "@prisma/client";
import { useFetcher } from "@remix-run/react";
import { useState, useEffect, useCallback } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { updateMedia } from "../models/recommendation.server";

interface UpdateMediaModalProps {
  recommendation: Recommendation | null;
  onClose: () => void;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const recommendationId = formData.get('recommendationId') as string;
  const image = formData.get('image') as File;

  await updateMedia(request, recommendationId, image);
  return { success: true };
}

export function UpdateMediaModal({ recommendation, onClose }: UpdateMediaModalProps) {
  const submitFetcher = useFetcher<typeof action>();
  const [files, setFiles] = useState<File[]>([]);

  const fileUpload = !files.length && <DropZone.FileUpload actionHint="or drop files to upload" />;
  const uploadedFiles = files.length > 0 && (
    <BlockStack>
      {files.map((file, index) => (
        <BlockStack align="center" key={index}>
          <Thumbnail
            size="large"
            alt={file.name}
            source={window.URL.createObjectURL(file)}
          />
          {file.name}
        </BlockStack>
      ))}
    </BlockStack>
  );

  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  useEffect(() => {
    if (submitFetcher.state === 'idle' && submitFetcher.data?.success) {
      handleClose();
    }
  }, [submitFetcher.state, submitFetcher.data]);

  const handleDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) =>
      setFiles(acceptedFiles),
    []
  );

  const isValid = files.length > 0;

  return (
    <Modal
      open={recommendation !== null}
      onClose={handleClose}
      title="Update Media"
      primaryAction={{
        content: 'Update',
        onAction: () => {
          if (!recommendation || !files[0]) {
            throw new Error('Recommendation and image are required');
          }
          const formData = new FormData();
          formData.append('recommendationId', recommendation.id);
          formData.append('image', files[0], files[0].name);

          submitFetcher.submit(formData, {
            method: 'post',
            action: '/app/reco/update-media',
            encType: 'multipart/form-data'
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
          <DropZone accept="image/*" type="image" onDrop={handleDrop}>
            {uploadedFiles}
            {fileUpload}
          </DropZone>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
