import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import {
  CheckCircleTwoTone,
  SendOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Button, Modal, Typography } from "antd";
import Paragraph from "antd/lib/skeleton/Paragraph";
import Link from "next/link";

const { Text } = Typography;

const uploadAudio = (collab) => {
  const audio = collab.get("audios")[0];
  const collabId = collab.get("id");

  const formData = new FormData();
  formData.append("file", audio.blob, "audio.webm");
  formData.append("collabId", collabId);

  return fetch("/api/audio", {
    method: "POST",
    body: formData,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.message);
    }
    return response.json();
  });
};

const uploadCameraClips = (collab) => {
  const cameraClips = collab.get("cameraClips");
  const collabId = collab.get("id");

  return cameraClips.map((clip) => {
    const formData = new FormData();
    formData.append("file", clip.blob, "video.webm");
    formData.append("collabId", collabId);

    return fetch("/api/cameraClip", {
      method: "POST",
      body: formData,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.message);
      }
      return response.json();
    });
  });
};

const uploadSlides = (collab) => {
  const slides = collab.get("slides");
  const collabId = collab.get("id");

  return slides.map((slide) => {
    const formData = new FormData();
    formData.append("file", slide.file);
    formData.append("collabId", collabId);

    return fetch("/api/slide", {
      method: "POST",
      body: formData,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.message);
      }
      return response.json();
    });
  });
};

const uploadImages = (collab) => {
  const images = collab.get("images");
  const collabId = collab.get("id");

  return images.map((image) => {
    const formData = new FormData();
    formData.append("file", image.file);
    formData.append("collabId", collabId);

    return fetch("/api/image", {
      method: "POST",
      body: formData,
    }).then((response) => {
      if (!response.ok) {
        throw new Error(response.message);
      }
      return response.json();
    });
  });
};

const uploadStuffAndCreateCollab = async (collab) => {
  let audioFileData = null;
  let slidesDataList = [];
  let imagesDataList = [];
  let cameraClipList = [];
  try {
    [
      audioFileData,
      slidesDataList,
      imagesDataList,
      cameraClipList,
    ] = await Promise.all([
      uploadAudio(collab),
      Promise.all(uploadSlides(collab)),
      Promise.all(uploadImages(collab)),
      Promise.all(uploadCameraClips(collab)),
    ]);
  } catch (err) {
    console.error(err);
    throw new Error(err.message);
  }

  const collabId = collab.get("id");

  const collabRequestBody = {
    title: collab.get("title"),
    interactions: collab.get("interactions"),
    images: imagesDataList.map(({ fileKey }) => ({ fileKey })),
    audios: [{ fileKey: audioFileData.fileKey }],
    slides: slidesDataList.map((slidesData) => ({
      fileKey: slidesData.fileKey,
    })),
    cameraClip: cameraClipList.map((slidesData) => ({
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
  const { collab } = useContext(EditorContext);
  const [isCreating, setCreationState] = useState(false);
  const [generatedCollab, setGeneratedCollab] = useState(null);

  const createVideo = useCallback(async () => {
    setCreationState(true);
    const uploadedCollab = await uploadStuffAndCreateCollab(collab);
    setCreationState(false);
    setGeneratedCollab(uploadedCollab);

    const generatedCollab = await pollUntilCreation(uploadedCollab);

    setGeneratedCollab(generatedCollab);
  });

  const linkToView = createLink(generatedCollab);

  return (
    <>
      <Modal visible={isCreating} closable={false} footer={null}>
        Uploading assets: <br />
        <Text>
          <CheckCircleTwoTone twoToneColor="#52c41a" /> Images
        </Text>
        <br />
        <Text>
          <SyncOutlined spin /> Audio
        </Text>
        <br />
        <Text>
          <SyncOutlined spin /> Slides
        </Text>
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
        type="primary"
        shape="circle"
        size="large"
        disabled={collab.get("audios").length === 0}
        icon={<SendOutlined />}
        onClick={!isCreating && createVideo}
      />
    </>
  );
}
