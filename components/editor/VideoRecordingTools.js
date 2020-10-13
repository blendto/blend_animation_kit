//@flow
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { VideoCameraTwoTone } from "@ant-design/icons";
import { Button, Row } from "antd";
import { useState } from "react";
import { RecordRTCPromisesHandler } from "recordrtc";
import { EditorContext } from "../data/EditorContext";

const captureUserMedia = async () => {
  var params = {
    audio: false,
    video: { width: 640, height: 480, facingMode: "user" },
  };
  return await navigator.mediaDevices?.getUserMedia(params);
};

export default function VideoRecordingTools() {
  const {
    cameraStream,
    setCameraStream,
    collab,
    onVideoRecordingStart,
    onVideoRecordingStop,
  } = useContext(EditorContext);
  const [isCameraOn, setCameraStatus] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const videoPlayerRef = useRef(null);

  const startRecording = useCallback(async () => {
    let recorder = new RecordRTCPromisesHandler(cameraStream, {
      type: "video",
    });
    recorder.startRecording();
    setRecorder(recorder);
    onVideoRecordingStart();
  }, [cameraStream]);

  const stopRecording = useCallback(async () => {
    if (!recorder) {
      throw new Error("IllegalState: Recorder not found");
    }

    recorder.stopRecording().then(async () => {
      const blob = await recorder.getBlob();

      onVideoRecordingStop(blob);
    });

    setRecorder(null);
  }, [recorder]);

  const startCamera = useCallback(async () => {
    const stream = await captureUserMedia();
    if (!stream) {
      return;
    }
    setCameraStream(stream);
    setCameraStatus(true);
  });

  const stopCamera = useCallback(async () => {
    setCameraStream((stream) => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      return null;
    });
    setCameraStatus(false);
  });

  useEffect(() => {
    // Toggles recording when the global audio state changes
    const toggleRecording = async () => {
      const isRecording = collab.get("isRecording");

      if (isRecording && !recorder && cameraStream) {
        await startRecording();
        return;
      }

      if (!isRecording && recorder) {
        await stopRecording();
        return;
      }
    };

    toggleRecording();
    return () => {};
  }, [
    collab.get("isRecording"),
    recorder,
    cameraStream,
    startRecording,
    stopRecording,
  ]);

  useEffect(() => {
    // When camera stream state changes, check global recording state,
    // and start or stop the state
    const toggleRecordingOnCameraStreamChange = async () => {
      const isRecording = collab.get("isRecording");

      if (!cameraStream && recorder) {
        await stopRecording();
        return;
      }

      if (cameraStream && isRecording && !recorder) {
        await startRecording();
        return;
      }
    };

    toggleRecordingOnCameraStreamChange();
  }, [
    cameraStream,
    recorder,
    startRecording,
    stopRecording,
    collab.get("isRecording"),
  ]);

  return (
    <Row>
      {!isCameraOn ? (
        <Button
          icon={<VideoCameraTwoTone twoToneColor="#389e0d" />}
          onClick={startCamera}
        >
          Start Video
        </Button>
      ) : (
        <Button
          icon={<VideoCameraTwoTone twoToneColor="#cf1322" />}
          onClick={stopCamera}
        >
          Stop Video
        </Button>
      )}
    </Row>
  );
}
