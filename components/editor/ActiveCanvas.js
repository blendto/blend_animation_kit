// @flow
import styles from "./EditorSections.module.css";
import React, { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { Page } from "react-pdf";

const getCurrentActiveImage = (collab) => {
  const interactions = collab.get("interactions");

  for (let i = interactions.length - 1; i >= 0; i--) {
    const { action, index, type } = interactions[i];

    if (action === "DISPLAY" && type === "IMAGE") {
      return collab.get("images")[index];
    }
  }

  return null;
};

const getLastActivePrimaryElement = (collab) => {
  const interactions = collab.get("interactions");
  const _parsedPdf = collab.get("_currentParsedPdf");

  for (let i = interactions.length - 1; i >= 0; i--) {
    const { action, index, slideIndex, type } = interactions[i];

    if (action === "DISPLAY") {
      if (type === "IMAGE") {
        return { image: collab.get("images")[index] };
      }
      if (type === "SLIDE") {
        return {
          slideFile: collab.get("slides")[index],
          slideIndex,
          _parsedPdf,
        };
      }
    }
  }

  return {};
};

const calculateOptimalCanvasSize = () => {
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0
  );

  let canvasWidth = vw;
  let canvasHeight = (canvasWidth * 9) / 16;

  if (canvasHeight > 0.6 * vh) {
    canvasHeight = 0.6 * vh;
    canvasWidth = (canvasHeight * 16) / 9;
  }

  return { width: canvasWidth, height: canvasHeight };
};

const getCameraDimensions = (stream) => {
  if (!stream) {
    return { width: 0, height: 0 };
  }
  const tracks = stream.getVideoTracks();
  if (!tracks.length) {
    throw new Error("No tracks in stream");
  }
  const [firstTrack] = tracks;
  const settings = firstTrack.getSettings();
  return { width: settings.width || 0, height: settings.height || 0 };
};

const calculateVideoPlayerStyle = ({ width, height }) => {
  return {
    width: 0.2 * width,
    height: 0.2 * width,
  };
};

export default function ActiveCanvas() {
  const { collab, cameraStream } = useContext(EditorContext);
  const [videoPlayerRef, setVideoPlayerRef] = useState(null);

  const onVideoPlayerLoad = useCallback((videoPlayerRef) => {
    setVideoPlayerRef(videoPlayerRef);

    if (videoPlayerRef && cameraStream) {
      videoPlayerRef.srcObject = cameraStream;
    }
  });

  const {
    image,
    slideFile,
    slideIndex,
    _parsedPdf,
  } = getLastActivePrimaryElement(collab);

  const { width, height } = calculateOptimalCanvasSize();

  const { width: cameraWidth, height: cameraHeight } = getCameraDimensions(
    cameraStream
  );

  return (
    <div className={styles.activeCanvas} style={{ width, height }}>
      {!(image || slideFile) && <span>Choose an image</span>}
      {image && (
        <img className={styles.imagePreview} src={image.preview || image.url} />
      )}
      {slideFile && (
        <Page
          className={styles.imagePreview}
          pdf={_parsedPdf}
          pageIndex={slideIndex}
          width={width}
          renderTextLayer={false}
        />
      )}
      {cameraStream && (
        <video
          style={calculateVideoPlayerStyle({
            width,
            height,
          })}
          className={styles.camera}
          ref={onVideoPlayerLoad}
          controls={false}
          autoPlay
          muted
          width={cameraWidth}
          height={cameraHeight}
        />
      )}
    </div>
  );
}
