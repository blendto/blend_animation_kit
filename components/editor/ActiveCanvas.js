import styles from "./EditorSections.module.css";
import { useState, useCallback, useContext } from "react";
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
        return { images: collab.get("images")[index] };
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

export default function ActiveCanvas() {
  const { collab } = useContext(EditorContext);

  const {
    image,
    slideFile,
    slideIndex,
    _parsedPdf,
  } = getLastActivePrimaryElement(collab);

  const { width, height } = calculateOptimalCanvasSize();

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
    </div>
  );
}
