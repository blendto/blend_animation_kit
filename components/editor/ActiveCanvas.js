// @flow
import styles from "./EditorSections.module.css";
import React, { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import { Page } from "react-pdf";
import invariant from "tiny-invariant";
import { Gif } from "@giphy/react-components";

import type { CollabImageItem } from "../data/EditorContext";

const getLastActivePrimaryElement = (collab) => {
  invariant(collab);
  const {
    interactions,
    images,
    slides,
    _currentParsedPdf: _parsedPdf,
  } = collab;

  for (let i = interactions.length - 1; i >= 0; i--) {
    const { action, index, slideIndex, type } = interactions[i];

    if (action === "DISPLAY") {
      if (type === "IMAGE") {
        return { image: images[index] };
      }
      if (type === "SLIDE") {
        return {
          slideFile: slides[index],
          slideIndex,
          _parsedPdf,
        };
      }
    }
  }

  return {};
};

const getLastActiveSecondaryElement = (collab) => {
  invariant(collab);
  const { interactions, images } = collab;

  for (let i = interactions.length - 1; i >= 0; i--) {
    const { action, index, slideIndex, type } = interactions[i];

    if (action === "DISPLAY") {
      return null;
    }

    if (action === "DISPLAY_INLINE") {
      if (type === "IMAGE") {
        return { image: images[index] };
      }
      throw new Error(`Unsupported type ${type} for ${action}`);
    }
  }
};

const calculateOptimalCanvasSize = () => {
  const vw = Math.max(
    document.documentElement?.clientWidth || 0,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement?.clientHeight || 0,
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

  const secondaryItem = getLastActiveSecondaryElement(collab);

  const { width, height } = calculateOptimalCanvasSize();

  const { width: cameraWidth, height: cameraHeight } = getCameraDimensions(
    cameraStream
  );

  return (
    <div className={styles.activeCanvas} style={{ width, height }}>
      {!(image || slideFile) && <span>Choose an image</span>}
      {image && <img className={styles.imagePreview} src={image.preview} />}
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
      {secondaryItem && (
        <InlineItem item={secondaryItem} canvasSize={{ width, height }} />
      )}
    </div>
  );
}

type InlineItemProps = {
  image: CollabImageItem,
};
type InlineItemComponentsProps = {
  item: InlineItemProps,
  canvasSize: {
    width: number,
    height: number,
  },
};

function InlineItem({ item, canvasSize }: InlineItemComponentsProps) {
  const { width: canvasWidth, height: canvasHeight } = canvasSize;

  const { image } = item;

  if (image.imageType === "GIF") {
    const { file } = image;
    const original = file.images.original_mp4;

    const optimalWidth = 0.3 * canvasWidth;

    return (
      <div className={styles.inline}>
        <Gif gif={file} width={optimalWidth} />
      </div>
    );
  }

  throw new Error("Cant show this inline");
}
