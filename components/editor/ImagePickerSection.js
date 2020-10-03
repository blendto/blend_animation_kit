import { useState, useCallback, useContext } from "react";
import { EditorContext } from "../data/EditorContext";
import PicturesWall from "./PicturesWall";
import styles from "./EditorSections.module.css";

export default function ImagePickerSection() {
  const { onImageFilesChange, onImageSelect } = useContext(EditorContext);

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

  return <PicturesWall onChange={onChange} onPreview={onImageSelect} />;
}
