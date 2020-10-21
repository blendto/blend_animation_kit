import { Button, Space, Tooltip } from "antd";
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
  const [micPermissionStatus, setMicPermissionStatus] = useState(null);
  const toggleRecordingState = useCallback(() => {
    if (!isRecording) {
      if (micPermissionStatus !== null && micPermissionStatus !== "denied") {
        onRecordingStart();
        setRecordingState(true);
      } else if (micPermissionStatus === null) {
        navigator.permissions
          .query({ name: "microphone" })
          .then((permissionStatus) => {
            setMicPermissionStatus(permissionStatus.state);

            if (permissionStatus.state !== "denied") {
              onRecordingStart();
              setRecordingState(true);
            }
            permissionStatus.onchange = function () {
              setMicPermissionStatus(this.state);
            };
          });
      }
      return;
    }
    setRecordingState(false);
  }, [isRecording, micPermissionStatus]);

  return (
    <div className={styles.audioControls}>
      <Space>
        <DynamicallyLoadedReactMic
          className={styles.audioWave}
          record={isRecording}
          onStop={onRecordingDone}
          visualSetting="sinewave"
        />
        <Tooltip
          visible={micPermissionStatus === "denied"}
          title="Audio permission is denied. Please allow the permission and retry."
        >
          {!isRecording ? (
            <Button
              shape="round"
              size="large"
              icon={<AudioFilled />}
              onClick={toggleRecordingState}
              disabled={collab.get("audios").length}
              danger
            >
              Record
            </Button>
          ) : (
            <Button
              shape="round"
              size="large"
              icon={<AudioFilled />}
              onClick={toggleRecordingState}
              danger
            >
              Stop
            </Button>
          )}
        </Tooltip>
      </Space>
    </div>
  );
}
