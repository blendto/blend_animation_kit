import styles from "./Editor.module.css";

import { Typography } from "antd";
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
        <CollabTitle />
        <ActiveCanvas />
        <ImagePickerSection />
        <div className={styles.recordAndSendBar}>
          <AudioRecordingSection />
          <CreateVideoButton />
        </div>
      </div>
    </EditorContextProvider>
  );
}

function CollabTitle() {
  const { collab, onChangeTitle } = useContext(EditorContext);

  return (
    <Title editable={{ onChange: onChangeTitle }}>{collab.get("title")}</Title>
  );
}
