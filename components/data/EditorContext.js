//@flow
import { Map } from "immutable";
import { useCallback, useState, useEffect } from "react";

import type { RecordFactory, RecordOf } from "immutable";

import { List as ImmutableList, Record } from "immutable";
import * as React from "react";
import invariant from "tiny-invariant";

const defaultCollabState = {
  id: "",
  title: "Untitled Collab",
  images: [],
  audios: [],
  slides: [],
  cameraClips: [],
  interactions: [],
  isRecording: false,
  _currentParsedPdf: null,
};

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

type ImageType = "NORMAL" | "GIF";

export type CollabImageItem = {
  file: File | Object,
  imageType: ImageType,
  preview?: string,
  uploadStatus: "ADDED" | "UPLOADING" | "UPLOADED" | "ERROR",
};

type CollabInteractionItem = {
  action: "DISPLAY" | "DISPLAY_INLINE",
  index: number,
  slideIndex?: number,
  time: number,
  type: "SLIDE" | "IMAGE",
};

type CollabPropsType = {
  id: string,
  title: string,
  audios: Array<any>,
  images: Array<CollabImageItem>,
  slides: Array<any>,
  cameraClips: Array<any>,
  interactions: Array<CollabInteractionItem>,
  isRecording: boolean,
  _currentParsedPdf: ?any,
};

const makeCollab: RecordFactory<CollabPropsType> = Record(defaultCollabState);

type CollabRecord = RecordOf<CollabPropsType>;

type EditorContextRecord = {
  collab: ?CollabRecord,
  initialize: (string) => void,
  onChangeTitle: (string) => void,
  onRecordingStart: () => void,
  onRecordingDone: (Blob) => void,
  onImageSelect: (string) => void,
  onSlideSelect: (fileUid: string, slideIndex: number, _parsedPdf: any) => void,
  onFileDrop: (File, string, string) => void,
  cameraStream: ?MediaStream,
  setCameraStream: ?(((?MediaStream) => ?MediaStream) | MediaStream),
  onVideoRecordingStart: () => void,
  onVideoRecordingStop: (Blob) => void,
  onGifSelect: (Object) => void,
};

export const EditorContext: React$Context<EditorContextRecord> = React.createContext<EditorContextRecord>();

const currentRecordedTime = () => {
  const { completedMillis, lastStartTime } = timeTracker;
  return completedMillis + (lastStartTime ? Date.now() - lastStartTime : 0);
};

type Props = {
  children: React.Node,
};

export default function EditorContextProvider({
  children,
}: Props): React$Element<
  React$ComponentType<{
    children?: React$Node,
    value: ?EditorContextRecord,
    ...
  }>
> {
  const [collab, setCollab] = useState<?CollabRecord>(null);
  const [cameraStream, setCameraStream] = useState<?MediaStream>(null);

  useEffect(() => {
    if (!collab) {
      return;
    }
    const { isRecording } = collab;
    const wasRecording = !!timeTracker.lastStartTime;

    if (isRecording) {
      // Start the clock
      timeTracker = {
        ...timeTracker,
        lastStartTime: Date.now(),
      };
    }

    if (!isRecording && wasRecording) {
      invariant(
        timeTracker.lastStartTime,
        "lastStartTime is expected to be filled"
      );
      timeTracker = {
        completedMillis:
          timeTracker.completedMillis +
          (Date.now() - timeTracker.lastStartTime),
        lastStartTime: null,
      };
    }

    return () => {};
  }, [collab?.isRecording]);

  const initialize = useCallback((id: string) => {
    setCollab(makeCollab({ ...defaultCollabState, id }));
  });

  const onChangeTitle = useCallback((value: string) => {
    setCollab((collab) => collab?.set("title", value));
  }, []);

  const onRecordingStart = useCallback(() =>
    setCollab((collab) => collab?.set("isRecording", true))
  );

  const onRecordingDone = useCallback((recordedBlob) => {
    // We have to do functional setState here because even if onRecordingDone changes
    // when we add collab to deps, stupid React-Mic only accepts onStart on mount, and
    // ignores subsequent changes
    setCollab((collab) =>
      collab?.set("audios", [recordedBlob]).set("isRecording", false)
    );
  }, []);

  const onImageSelect = useCallback((imageUid: string) => {
    setCollab((collab) => {
      invariant(collab);
      const { images, interactions } = collab;
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

  const onSlideSelect = useCallback(
    (fileUid: string, slideIndex: number, _parsedPdf: any) => {
      setCollab((collab) => {
        invariant(collab);
        const { slides, interactions } = collab;
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
    }
  );

  const onFileDrop = useCallback((file, fileType, preview) => {
    setCollab((collab) => {
      invariant(collab);
      if (fileType === "SLIDE") {
        const { slides } = collab;

        const updatedSlides = [
          ...slides,
          { file, uploadStatus: FileStatus.Added },
        ];

        return collab.set("slides", updatedSlides);
      }

      if (fileType === "IMAGE") {
        const { images } = collab;

        const updatedImages = [
          ...images,
          {
            file,
            uploadStatus: FileStatus.Added,
            preview,
            imageType: "NORMAL",
          },
        ];

        return collab.set("images", updatedImages);
      }
      throw new Error("Unknown file type: " + fileType);
    });
  });

  const onVideoRecordingStart = useCallback(() => {
    setCollab((collab) => {
      invariant(collab);

      const newInteraction = {
        action: "DISPLAY",
        index: -1, // To be updated on recording end
        time: currentRecordedTime(),
        type: "CAMERA_CLIP",
      };

      return addInteractionToCollab(collab, newInteraction);
    });
  });

  const onVideoRecordingStop = useCallback((blob) => {
    setCollab((collab) => {
      invariant(collab);
      const { cameraClips, interactions } = collab;

      const updatedCameraClips = [
        ...cameraClips,
        { blob, uploadStatus: FileStatus.Added },
      ];

      const interactionIndex = getLastCameraClipDisplayInteractionIndex(collab);

      if (interactionIndex < 0) {
        throw new Error("No interaction found to add video to");
      }

      const displayVideoStartInteraction = interactions[interactionIndex];

      const updatedInteraction = {
        ...displayVideoStartInteraction,
        index: updatedCameraClips.length - 1,
      };

      const updatedInteractions = Object.assign([], (interactions: Object), {
        [interactionIndex]: updatedInteraction,
      });

      return collab
        .set("cameraClips", updatedCameraClips)
        .set("interactions", updatedInteractions);
    });
  });

  const onGifSelect = useCallback((gif: Object) => {
    setCollab((collab) => {
      invariant(collab);

      const { images, interactions } = collab;

      const updatedImages = [
        ...images,
        { file: gif, uploadStatus: FileStatus.Uploaded, imageType: "GIF" },
      ];

      const newInteraction = {
        action: "DISPLAY_INLINE",
        index: updatedImages.length - 1,
        time: currentRecordedTime(),
        type: "IMAGE",
      };

      return addInteractionToCollab(
        collab.set("images", updatedImages),
        newInteraction
      );
    });
  });

  const contextValue = {
    collab,
    initialize,
    onChangeTitle,
    onRecordingStart,
    onRecordingDone,
    onImageSelect,
    onSlideSelect,
    onFileDrop,
    cameraStream,
    setCameraStream,
    onVideoRecordingStart,
    onVideoRecordingStop,
    onGifSelect,
  };
  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

const getLastCameraClipDisplayInteractionIndex = (collab) => {
  const interactions = collab.get("interactions");

  for (let i = interactions.length - 1; i >= 0; i--) {
    const { action, index, slideIndex, type } = interactions[i];

    if (action === "DISPLAY") {
      if (type === "CAMERA_CLIP") {
        return i;
      }
    }
  }

  return -1;
};

const addInteractionToCollab = (collab: CollabRecord, newInteraction) => {
  const { interactions } = collab;

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
