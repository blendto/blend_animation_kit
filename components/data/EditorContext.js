import { Map } from "immutable";
import { useCallback, useState } from "react";

const defaulEditorState = Map({
  title: "Untitled Collab",
  images: [],
  audios: [],
  interactions: [],
});

export const EditorContext = React.createContext(defaulEditorState);

export default function EditorContextProvider({ children }) {
  const [collab, setCollab] = useState(defaulEditorState);

  const onChangeTitle = useCallback((value) => {
    setCollab((collab) => collab.set("title", value));
  }, []);

  const onRecordingDone = useCallback((recordedBlob) => {
    // We have to do functional setState here because even if onRecordingDone changes
    // when we add collab to deps, stupid React-Mic only accepts onStart on mount, and
    // ignores subsequent changes
    setCollab((collab) => collab.set("audios", [recordedBlob]));
  }, []);

  const onImageFilesChange = useCallback((imagesList) => {
    console.log(imagesList);
    setCollab((collab) => collab.set("images", imagesList));
  });

  const onImageSelect = useCallback((imageUid) => {
    setCollab((collab) => {
      const interactions = collab.get("interactions");
      const images = collab.get("images");
      const imageIndex = images.findIndex((image) => image.uid === imageUid);
      if (imageIndex < 0) {
        throw new Error("No such image found");
      }
      const newInteraction = {
        action: "DISPLAY",
        index: imageIndex,
        time: 0, // to be fixed
        type: "IMAGE",
      };
      //TODO: check if interaction is same as lastInteraction
      return collab.set("interactions", [...interactions, newInteraction]);
    });
  });

  const contextValue = {
    collab,
    onChangeTitle,
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
