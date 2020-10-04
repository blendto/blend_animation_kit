import { Button, Space } from "antd";
import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { AudioOutlined, AudioFilled } from "@ant-design/icons";
import dynamic from "next/dynamic";
import styles from "./EditorSections.module.css";

const DynamicallyLoadedReactMic = dynamic(
  () => import("react-mic").then((mod) => mod.ReactMic),
  { ssr: false }
);

export default function AudioRecordingSection() {
  const { collab, onRecordingDone, onRecordingStart } = useContext(
    EditorContext
  );
  const [isRecording, setRecordingState] = useState(false);
  const toggleRecordingState = useCallback(() => {
    if (!isRecording) {
      onRecordingStart();
    }
    setRecordingState(!isRecording);
  }, [isRecording]);

  return (
    <div className={styles.audioControls}>
      <Space>
        <DynamicallyLoadedReactMic
          className={styles.audioWave}
          record={isRecording}
          onStop={onRecordingDone}
          visualSetting="sinewave"
        />
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={isRecording ? <AudioFilled /> : <AudioOutlined />}
          onClick={toggleRecordingState}
          disabled={collab.get("audios").length}
        />
      </Space>
    </div>
  );
}
