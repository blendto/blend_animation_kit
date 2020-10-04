import { Map } from "immutable";
import { useCallback, useState, useEffect } from "react";

const defaulEditorState = Map({
  title: "Untitled Collab",
  images: [],
  audios: [],
  interactions: [],
  isRecording: false,
});

export const EditorContext = React.createContext(defaulEditorState);

let timeTracker = {
  completedMillis: 0,
  lastStartTime: null,
};

const currentRecordedTime = () => {
  const { completedMillis, lastStartTime } = timeTracker;
  return completedMillis + (lastStartTime ? Date.now() - lastStartTime : 0);
};

export default function EditorContextProvider({ children }) {
  const [collab, setCollab] = useState(defaulEditorState);

  useEffect(() => {
    const isRecording = collab.get("isRecording");
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
  }, [collab.get("isRecording")]);

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
    console.log(imagesList);
    setCollab((collab) => collab.set("images", imagesList));
  });

  const onImageSelect = useCallback((imageUid, filePreview) => {
    setCollab((collab) => {
      let interactions = collab.get("interactions");
      const images = collab.get("images");
      const imageIndex = images.findIndex((image) => image.uid === imageUid);
      if (imageIndex < 0) {
        throw new Error("No such image found");
      }
      const updatedImages = [...images];
      updatedImages[imageIndex] = {
        ...updatedImages[imageIndex],
        preview: filePreview,
      };
      const newInteraction = {
        action: "DISPLAY",
        index: imageIndex,
        time: currentRecordedTime(),
        type: "IMAGE",
      };

      const lastInteraction =
        interactions.length > 0 ? interactions[interactions.length - 1] : null;
      if (lastInteraction) {
        if (
          newInteraction.action === lastInteraction.action &&
          newInteraction.index === lastInteraction.index &&
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
          return collab
            .set("interactions", newInteractions)
            .set("images", updatedImages);
        }
      }
      return collab
        .set("interactions", [...interactions, newInteraction])
        .set("images", updatedImages);
    });
  });

  const contextValue = {
    collab,
    onChangeTitle,
    onRecordingStart,
    onRecordingDone,
    onImageFilesChange,
    onImageSelect,
  };
  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}
