import { Map } from "immutable";
import { useCallback, useState, useEffect } from "react";

const defaulEditorState = null;

export const EditorContext = React.createContext(defaulEditorState);

let timeTracker = {
  completedMillis: 0,
  lastStartTime: null,
};

export const FileStatus = {
  Added: "ADDED",
  Uploading: "UPLOADING",
  Uploaded: "UPLOADED",
  Error: "ERROR",
};

const currentRecordedTime = () => {
  const { completedMillis, lastStartTime } = timeTracker;
  return completedMillis + (lastStartTime ? Date.now() - lastStartTime : 0);
};

export default function EditorContextProvider({ children }) {
  const [collab, setCollab] = useState(defaulEditorState);

  useEffect(() => {
    const isRecording = collab?.get("isRecording");
    const wasRecording = !!timeTracker.lastStartTime;

    if (isRecording) {
      // Start the clock
      timeTracker = {
        ...timeTracker,
        lastStartTime: Date.now(),
      };
    }

    if (!isRecording && wasRecording) {
      timeTracker = {
        completedMillis:
          timeTracker.completedMillis +
          (Date.now() - timeTracker.lastStartTime),
        lastStartTime: null,
      };
    }

    return () => {};
  }, [collab?.get("isRecording")]);

  const initialize = useCallback((id) => {
    setCollab(
      Map({
        id,
        title: "Untitled Collab",
        images: [],
        audios: [],
        slides: [],
        interactions: [],
        isRecording: false,
        _currentParsedPdf: null,
      })
    );
  });

  const onChangeTitle = useCallback((value) => {
    setCollab((collab) => collab.set("title", value));
  }, []);

  const onRecordingStart = useCallback(() =>
    setCollab((collab) => collab.set("isRecording", true))
  );

  const onRecordingDone = useCallback((recordedBlob) => {
    // We have to do functional setState here because even if onRecordingDone changes
    // when we add collab to deps, stupid React-Mic only accepts onStart on mount, and
    // ignores subsequent changes
    setCollab((collab) =>
      collab.set("audios", [recordedBlob]).set("isRecording", false)
    );
  }, []);

  const onImageFilesChange = useCallback((imagesList) => {
    setCollab((collab) => collab.set("images", imagesList));
  });

  const onImageSelect = useCallback((imageUid) => {
    setCollab((collab) => {
      let interactions = collab.get("interactions");
      const images = collab.get("images");
      const imageIndex = images.findIndex(
        (image) => image.file.uid === imageUid
      );

      if (imageIndex < 0) {
        throw new Error("No such image found");
      }

      const newInteraction = {
        action: "DISPLAY",
        index: imageIndex,
        time: currentRecordedTime(),
        type: "IMAGE",
      };

      return addInteractionToCollab(collab, newInteraction);
    });
  });

  const onSlideSelect = useCallback((fileUid, slideIndex, _parsedPdf) => {
    setCollab((collab) => {
      let interactions = collab.get("interactions");
      const slides = collab.get("slides");
      const slideFileIndex = slides.findIndex(
        (slide) => slide.file.uid === fileUid
      );
      if (slideFileIndex < 0) {
        throw new Error("No such slide file found");
      }

      const newInteraction = {
        action: "DISPLAY",
        index: slideFileIndex,
        slideIndex,
        time: currentRecordedTime(),
        type: "SLIDE",
      };

      const updatedCollab = collab.set("_currentParsedPdf", _parsedPdf);

      return addInteractionToCollab(updatedCollab, newInteraction);
    });
  });

  const onFileDrop = useCallback((file, fileType, preview) => {
    setCollab((collab) => {
      if (fileType === "SLIDE") {
        const slides = collab.get("slides");

        const updatedSlides = [
          ...slides,
          { file, uploadStatus: FileStatus.Added },
        ];

        return collab.set("slides", updatedSlides);
      }

      if (fileType === "IMAGE") {
        const images = collab.get("images");

        const updatedImages = [
          ...images,
          { file, uploadStatus: FileStatus.Added, preview },
        ];

        return collab.set("images", updatedImages);
      }
      throw new Error("Unknown file type: " + fileType);
    });
  });

  const contextValue = {
    collab,
    initialize,
    onChangeTitle,
    onRecordingStart,
    onRecordingDone,
    onImageFilesChange,
    onImageSelect,
    onSlideSelect,
    onFileDrop,
  };
  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

const addInteractionToCollab = (collab, newInteraction) => {
  const interactions = collab.get("interactions");

  const lastInteraction =
    interactions.length > 0 ? interactions[interactions.length - 1] : null;
  if (lastInteraction) {
    if (
      newInteraction.action === lastInteraction.action &&
      newInteraction.index === lastInteraction.index &&
      newInteraction.slideIndex === lastInteraction.slideIndex &&
      newInteraction.type === lastInteraction.type
    ) {
      // Doing the same thing over and over ? Ignore
      return collab;
    }

    if (
      newInteraction.action === lastInteraction.action &&
      newInteraction.type === lastInteraction.type &&
      newInteraction.time === lastInteraction.time
    ) {
      // Doing the same thing but on a different index, at same time
      // Then its not recording. replace the last interaction
      const newInteractions = [...interactions];
      newInteractions[newInteractions.length - 1] = newInteraction;

      return collab.set("interactions", newInteractions);
    }
  }
  return collab.set("interactions", [...interactions, newInteraction]);
};
