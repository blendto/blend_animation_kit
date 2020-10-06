import styles from "./Editor.module.css";

import { Typography, Space } from "antd";
import EditorContextProvider, { EditorContext } from "../data/EditorContext";
import { useContext } from "react";
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
    </EditorContextProvider>
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
