import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { SendOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Modal } from "antd";

const uploadAudioAndCreateCollab = async (collab) => {
  const audio = collab.get("audios")[0];

  const formData = new FormData();
  formData.append("file", audio.blob, "audio.webm");

  let audioFileData = await fetch("/api/audio", {
    method: "POST",
    body: formData,
  }).then((response) => {
    if (!response.ok) {
      throw new Error(response.message);
    }
    return response.json();
  });

  const collabRequestBody = {
    title: collab.get("title"),
    interactions: collab.get("interactions"),
    images: collab.get("images").map(({ fileKey }) => ({ fileKey })),
    audios: [{ fileKey: audioFileData.fileKey }],
  };

  const collabResult = await fetch("/api/collab", {
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

const OUTPUT_BUCKET_BASE_PATH =
  "https://collabice-output.s3.us-east-2.amazonaws.com/";

const createLink = (generatedCollab) => {
  return OUTPUT_BUCKET_BASE_PATH + generatedCollab?.filePath;
};

export default function CreateVideoButton() {
  const { collab } = useContext(EditorContext);
  const [isCreating, setCreationState] = useState(false);
  const [generatedCollab, setGeneratedCollab] = useState(null);

  const createVideo = useCallback(async () => {
    setCreationState(true);
    const uploadedCollab = await uploadAudioAndCreateCollab(collab);

    const generatedCollab = await pollUntilCreation(uploadedCollab);

    setCreationState(false);
    setGeneratedCollab(generatedCollab);
  });

  return (
    <>
      <Modal visible={isCreating} closable={false} footer={null}>
        Generating the video. Please be patient
      </Modal>
      <Modal visible={!!generatedCollab} closable={false} footer={null}>
        Here is the link to the video: {createLink(generatedCollab)}
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
