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

export default function ActiveCanvas() {
  const { collab } = useContext(EditorContext);

  const image = getCurrentActiveImage(collab);

  return (
    <div className={styles.activeCanvas}>
      {!image && <span>Choose an image</span>}
      {image && (
        <img className={styles.imagePreview} src={image.preview || image.url} />
      )}
    </div>
  );
}
