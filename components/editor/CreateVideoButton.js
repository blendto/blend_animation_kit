import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { SendOutlined, SyncOutlined } from "@ant-design/icons";
import { Button } from "antd";

const uploadAudioAndCreateCollab = (collab) => {
  const audio = collab.get("audios")[0];

  const formData = new FormData();
  formData.append("file", audio.blob);

  fetch("/api/audio", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
    })
    .catch((error) => {
      console.error(error);
    });
};

export default function CreateVideoButton() {
  const { collab } = useContext(EditorContext);
  const [isCreating, setCreationState] = useState(false);

  const createVideo = useCallback(() => {
    setCreationState(true);
    uploadAudioAndCreateCollab(collab);
  });

  return (
    <Button
      type="primary"
      shape="circle"
      size="large"
      disabled={collab.get("audios").length === 0}
      icon={isCreating ? <SyncOutlined spin /> : <SendOutlined />}
      onClick={!isCreating && createVideo}
    />
  );
}
