//@flow
import { useState, useCallback, useContext, useEffect } from "react";
import { EditorContext, FileStatus } from "../data/EditorContext";
import { CheckCircleTwoTone, SyncOutlined } from "@ant-design/icons";
import { Button, Modal, Row, Typography } from "antd";
import Paragraph from "antd/lib/skeleton/Paragraph";
import Link from "next/link";
import FileUploader from "../data/FileUploader";
import invariant from "tiny-invariant";
import { queue } from "async";
import CollabHelper from "../data/helpers/CollabHelper";

import type { CollabRecord } from "../data/EditorContext";

const { Text } = Typography;

const PARALLEL_UPLOAD_COUNT = 2;

type CreationState =
  | "NOT_STARTED"
  | "UPLOADING"
  | "UPLOADING_COMPLETED"
  | "CREATING"
  | "CREATED";

const uploadAudios = (collab, onFileUpload) => {
  invariant(collab);
  const { id: collabId, audios } = collab;

  const tasks = [];
  audios.forEach((audio, index) => {
    if (audio.uploadStatus === FileStatus.Uploaded) {
      return;
    }

    tasks.push({
      execute: async () => {
        const { fileKey } = await FileUploader.uploadFileToS3(
          collabId,
          audio.blob,
          "AUDIO",
          "audio.webm"
        );
        onFileUpload("AUDIO", index, FileStatus.Uploaded, fileKey);
      },
    });
  });

  return tasks;
};

const uploadCameraClips = (collab, onFileUpload) => {
  invariant(collab);
  const { id: collabId, cameraClips } = collab;

  const tasks = [];
  cameraClips.forEach((clip, index) => {
    if (clip.uploadStatus === FileStatus.Uploaded) {
      return;
    }

    tasks.push({
      execute: async () => {
        const { fileKey } = await FileUploader.uploadFileToS3(
          collabId,
          clip.blob,
          "CAMERA_CLIP",
          "video.webm"
        );
        onFileUpload("CAMERA_CLIP", index, FileStatus.Uploaded, fileKey);
      },
    });
  });

  return tasks;
};

const uploadSlides = (collab, onFileUpload) => {
  invariant(collab);
  const { id: collabId, slides } = collab;

  const tasks = [];
  slides.forEach((slide, index) => {
    if (slide.uploadStatus === FileStatus.Uploaded) {
      return;
    }
    tasks.push({
      execute: async () => {
        const { fileKey } = await FileUploader.uploadFileToS3(
          collabId,
          slide.file,
          "SLIDE"
        );
        onFileUpload("SLIDE", index, FileStatus.Uploaded, fileKey);
      },
    });
  });

  return tasks;
};

const uploadImages = (collab, onFileUpload) => {
  invariant(collab);
  const { id: collabId, images } = collab;

  const tasks = [];
  images.forEach((image, index) => {
    const { fileKey, imageType, uploadStatus, file } = image;

    if (uploadStatus === FileStatus.Uploaded) {
      return;
    }

    tasks.push({
      execute: async () => {
        const { fileKey } = await FileUploader.uploadFileToS3(
          collabId,
          file,
          "IMAGE"
        );
        onFileUpload("IMAGE", index, FileStatus.Uploaded, fileKey);
      },
    });
  });

  return tasks;
};

const uploadRemainingFiles = async (collab, onFileUpload) => {
  const uploadingQueue = queue(async (task, callback) => {
    try {
      await task.execute();
    } catch (e) {
      console.error(e);
    }
    callback();
  }, PARALLEL_UPLOAD_COUNT);

  const tasks = []
    .concat(uploadImages(collab, onFileUpload))
    .concat(uploadSlides(collab, onFileUpload))
    .concat(uploadCameraClips(collab, onFileUpload))
    .concat(uploadAudios(collab, onFileUpload));

  uploadingQueue.push(tasks);

  await uploadingQueue.drain();
};

const createCollab = async (collab: CollabRecord) => {
  invariant(collab);
  const {
    id: collabId,
    title,
    interactions,
    images,
    slides,
    audios,
    cameraClips,
  } = collab;

  const collabRequestBody = {
    title,
    interactions,
    images: images.map(({ fileKey, imageType, file }) => ({
      fileKey,
      imageType,
      file,
    })),
    audios: audios.map((slidesData) => ({
      fileKey: slidesData.fileKey,
    })),
    slides: slides.map((slidesData) => ({
      fileKey: slidesData.fileKey,
    })),
    cameraClips: cameraClips.map((slidesData) => ({
      fileKey: slidesData.fileKey,
    })),
  };

  const collabResult = await fetch(`/api/collab/${collabId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(collabRequestBody),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.message);
    }
    return response.json();
  });

  return collabResult;
};

const pollUntilCreation = async (collab) => {
  const updatedCollab = await fetch(`/api/collab/${collab.id}`).then((res) =>
    res.json()
  );

  if (updatedCollab.status === "GENERATED") {
    return updatedCollab;
  }

  await new Promise((r) => setTimeout(r, 2000));

  return await pollUntilCreation(collab);
};

const createLink = (generatedCollab) => {
  return process.env.NEXT_PUBLIC_SELF_BASE_PATH + "v/" + generatedCollab?.id;
};

export default function CreateVideoButton() {
  const { collab, onFileUploadStatusChange } = useContext(EditorContext);
  invariant(collab);
  const [creationState, setCreationState] = useState<CreationState>(
    "NOT_STARTED"
  );
  const [generatedCollab, setGeneratedCollab] = useState(null);

  const createVideo = useCallback(async () => {
    setCreationState("UPLOADING");
    await uploadRemainingFiles(collab, onFileUploadStatusChange);
    setCreationState("UPLOADING_COMPLETED");
  });

  const createAndPollCollab = useCallback(async () => {
    invariant(collab);
    setCreationState("CREATING");
    const uploadedCollab = await createCollab(collab);
    setCreationState("CREATED");

    setGeneratedCollab(uploadedCollab);

    const generatedCollab = await pollUntilCreation(uploadedCollab);

    setGeneratedCollab(generatedCollab);
  }, [collab]);

  useEffect(() => {
    if (creationState === "UPLOADING_COMPLETED") {
      // But was it successful?
      invariant(collab);
      if (CollabHelper.hasAllFilesUploaded(collab)) {
        createAndPollCollab();
      }
    }
  }, [collab, creationState]);

  const linkToView = createLink(generatedCollab);

  return (
    <>
      <Modal
        visible={["UPLOADING", "UPLOADING_COMPLETED", "CREATING"].includes(
          creationState
        )}
        closable={false}
        footer={null}
      >
        Uploading assets: <br />
        <Row>
          {CollabHelper.areAllImagesUploaded(collab) ? (
            <CheckCircleTwoTone twoToneColor="#52c41a" />
          ) : (
            <SyncOutlined spin />
          )}
          Images
        </Row>
        <Row>
          {CollabHelper.areAllAudiosUploaded(collab) ? (
            <CheckCircleTwoTone twoToneColor="#52c41a" />
          ) : (
            <SyncOutlined spin />
          )}
          Audio
        </Row>
        <Row>
          {CollabHelper.areAllSlidesUploaded(collab) ? (
            <CheckCircleTwoTone twoToneColor="#52c41a" />
          ) : (
            <SyncOutlined spin />
          )}
          Slides
        </Row>
        <Row>
          {CollabHelper.areAllCameraClipsUploaded(collab) ? (
            <CheckCircleTwoTone twoToneColor="#52c41a" />
          ) : (
            <SyncOutlined spin />
          )}
          Camera Clips
        </Row>
        {creationState === "CREATING" && (
          <Row>
            <SyncOutlined spin /> Requesting Video Creation
          </Row>
        )}
      </Modal>
      <Modal
        visible={
          creationState === "UPLOADING_COMPLETED" &&
          !CollabHelper.hasAllFilesUploaded(collab)
        }
        okText="Retry"
        onOk={createVideo}
      >
        Oops! We could not upload some files. Check your internet connection and
        retry.
      </Modal>
      <Modal visible={!!generatedCollab} closable={false} footer={null}>
        {generatedCollab?.status === "SUBMITTED" && (
          <>
            <Text>
              Our servers are hard at work generating your amazing video.
              Meanwhile you can share the link, and the video will be available
              there once ready.
            </Text>
            <br />
          </>
        )}
        {generatedCollab?.status === "GENERATED" && (
          <>
            <Text>Yay, Your video is now generated.</Text> <br />
          </>
        )}
        Here is the link to it:{" "}
        <Link href={`/v/${generatedCollab?.id}`}>
          {createLink(generatedCollab)}
        </Link>
      </Modal>
      <Button
        shape="round"
        size="large"
        disabled={collab?.audios.length === 0}
        onClick={createVideo}
      >
        Publish
      </Button>
    </>
  );
}
