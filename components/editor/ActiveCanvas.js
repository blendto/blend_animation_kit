import styles from "./EditorSections.module.css";
import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";

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

const calculateOptimalCanvasSize = () => {
  const vw = Math.max(
    document.documentElement.clientWidth || 0,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement.clientHeight || 0,
    window.innerHeight || 0
  );

  let canvasWidth = vw - 20;
  let canvasHeight = (canvasWidth * 9) / 16;

  if (canvasHeight > 0.6 * vh) {
    canvasHeight = 0.6 * vh;
    canvasWidth = (canvasHeight * 16) / 9;
  }

  return { width: canvasWidth, height: canvasHeight };
};

export default function ActiveCanvas() {
  const { collab } = useContext(EditorContext);

  const image = getCurrentActiveImage(collab);

  const { width, height } = calculateOptimalCanvasSize();

  return (
    <div className={styles.activeCanvas} style={{ width, height }}>
      {!image && <span>Choose an image</span>}
      {image && (
        <img className={styles.imagePreview} src={image.preview || image.url} />
      )}
    </div>
  );
}
