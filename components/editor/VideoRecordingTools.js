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

  const startRecording = useCallback(async () => {
    let recorder = new RecordRTCPromisesHandler(cameraStream, {
      type: "video",
      ondataavailable: (blob) => {
        console.log("blob available");
        console.log(blob);
      },
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

  useEffect(() => {
    const isRecording = collab.get("isRecording");

    if (isRecording && !recorder) {
      startRecording();
      return;
    }

    if (!isRecording && recorder) {
      stopRecording();
      return;
    }

    return () => {};
  }, [collab.get("isRecording"), recorder]);

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
