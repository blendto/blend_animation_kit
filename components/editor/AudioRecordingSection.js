import { Button } from "antd";
import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import dynamic from "next/dynamic";

const DynamicallyLoadedReactMic = dynamic(
  () => import("react-mic").then((mod) => mod.ReactMic),
  { ssr: false }
);

export default function AudioRecordingSection() {
  const { onRecordingDone } = useContext(EditorContext);
  const [isRecording, setRecordingState] = useState(false);
  const toggleRecordingState = useCallback(() => {
    setRecordingState(!isRecording);
  }, [isRecording]);

  return (
    <div>
      <DynamicallyLoadedReactMic
        record={isRecording}
        onStop={onRecordingDone}
        visualSetting="sinewave"
      />
      <Button onClick={toggleRecordingState}>Record</Button>
    </div>
  );
}
