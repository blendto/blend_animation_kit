import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import PicturesWall from "./PicturesWall";
import styles from "./EditorSections.module.css";

export default function ImagePickerSection() {
  const { collab, onImageFilesChange, onImageSelect } = useContext(
    EditorContext
  );

  const onChange = useCallback(
    (filesList) => {
      const uploadedImages = filesList
        .filter((file) => file.status === "done")
        .map((file) => {
          const { uid, response, url, preview } = file;
          return {
            url,
            ...response, // Spread under url so that the response.url takes precedence
            preview,
            uid,
          };
        });

      onImageFilesChange(uploadedImages);
    },
    [onImageFilesChange]
  );

  return (
    <div className={styles.imagePicker}>
      <PicturesWall
        id={collab.get("id")}
        onChange={onChange}
        onPreview={onImageSelect}
      />
    </div>
  );
}
