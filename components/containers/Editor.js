import styles from "./Editor.module.css";

import { Typography, Space } from "antd";
import EditorContextProvider, { EditorContext } from "../data/EditorContext";
import { useContext } from "react";
import AudioRecordingSection from "../editor/AudioRecordingSection";

import ImagePickerSection from "../editor/ImagePickerSection";
import ActiveCanvas from "../editor/ActiveCanvas";
import CreateVideoButton from "../editor/CreateVideoButton";

const { Title } = Typography;

export default function EditorContainer() {
  return (
    <EditorContextProvider>
      <div className={styles.container}>
        <Space direction="vertical">
          <CollabTitle />
          <ActiveCanvas />
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
    <Title level={2} editable={{ onChange: onChangeTitle }}>
      {collab.get("title")}
    </Title>
  );
}
