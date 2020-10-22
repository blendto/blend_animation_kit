//@flow
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { VideoCameraTwoTone } from "@ant-design/icons";
import { Button, Row } from "antd";
import { useState } from "react";
import { EditorContext } from "../data/EditorContext";
import invariant from "tiny-invariant";

const captureUserMedia = async () => {
  var params = {
    audio: false,
    video: {
      width: 640,
      height: 480,
      facingMode: "user",
      frameRate: { ideal: 30, max: 30 },
    },
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
    const RecordRTC = await import("recordrtc");
    let recorder = new RecordRTC.RecordRTCPromisesHandler(cameraStream, {
      type: "video",
    });
    await recorder.startRecording();
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
    setCameraStream((stream: ?MediaStream) => {
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
      if (!collab) {
        return;
      }
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
    collab?.get("isRecording"),
    recorder,
    cameraStream,
    startRecording,
    stopRecording,
  ]);

  useEffect(() => {
    // When camera stream state changes, check global recording state,
    // and start or stop the state
    const toggleRecordingOnCameraStreamChange = async () => {
      if (!collab) {
        return;
      }
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
    collab?.get("isRecording"),
  ]);

  if (isCameraOn) {
    return (
      <Button
        size="large"
        shape="circle"
        icon={<VideoCameraTwoTone twoToneColor="#cf1322" />}
        onClick={stopCamera}
      />
    );
  }
  return (
    <Button
      size="large"
      shape="circle"
      icon={<VideoCameraTwoTone twoToneColor="#389e0d" />}
      onClick={startCamera}
    />
  );
}
