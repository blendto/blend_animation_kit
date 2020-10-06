import styles from "./Editor.module.css";

import { Typography, Space, Spin } from "antd";
import EditorContextProvider, { EditorContext } from "../data/EditorContext";
import { useContext, useEffect, useState } from "react";
import AudioRecordingSection from "../editor/AudioRecordingSection";

import ImagePickerSection from "../editor/ImagePickerSection";
import CreateVideoButton from "../editor/CreateVideoButton";
import dynamic from "next/dynamic";

const { Title } = Typography;

const ActiveCanvasWithNoSSR = dynamic(() => import("../editor/ActiveCanvas"), {
  ssr: false,
});

export default function EditorContainer() {
  return (
    <EditorContextProvider>
      <InitializeAndShowEditor />
    </EditorContextProvider>
  );
}

function InitializeAndShowEditor() {
  const { initialize } = useContext(EditorContext);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const callServerToInitialize = async () => {
      const collab = await fetch("/api/collab", {
        method: "POST",
        body: null,
      }).then((response) => {
        if (!response.ok) {
          throw new Error(response.message);
        }
        return response.json();
      });

      initialize(collab.id);
      setInitialized(true);
    };
    callServerToInitialize();
  }, []);

  if (!initialized) {
    return <Spin tip={"Initializing Editor"} />;
  }

  return (
    <div className={styles.container}>
      <Space direction="vertical">
        <CollabTitle />
        <ActiveCanvasWithNoSSR />
        <ImagePickerSection />
      </Space>
      <div className={styles.recordAndSendBar}>
        <Space>
          <AudioRecordingSection />
          <CreateVideoButton />
        </Space>
      </div>
    </div>
  );
}

function CollabTitle() {
  const { collab, onChangeTitle } = useContext(EditorContext);

  return (
    <div className={styles.titleSection}>
      <Title level={2} editable={{ onChange: onChangeTitle }}>
        {collab.get("title")}
      </Title>
    </div>
  );
}
