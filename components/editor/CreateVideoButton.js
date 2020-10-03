import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { SendOutlined, SyncOutlined } from "@ant-design/icons";
import { Button } from "antd";

export default function CreateVideoButton() {
  const [isCreating, setCreationState] = useState(false);

  const createVideo = useCallback(() => {});

  return (
    <Button
      type="primary"
      shape="circle"
      size="large"
      icon={isCreating ? <SyncOutlined /> : <SendOutlined />}
      onClick={!isCreating && createVideo}
    />
  );
}
