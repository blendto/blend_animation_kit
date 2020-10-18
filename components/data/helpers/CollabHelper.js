//@flow
import { FileStatus } from "../EditorContext";
import type { CollabRecord } from "../EditorContext";

export default class CollabHelper {
  // Using this because extending Immutable Record as a subclass is not working at all for typing
  // Even after doing exactly what is mentioned in the immutable docs for flowtyping subclasses
  // Investigate some other time.

  static hasAllFilesUploaded(collab: CollabRecord): boolean {
    const { images, slides, cameraClips, audios } = collab;
    return (
      this.areAllAudiosUploaded(collab) &&
      this.areAllImagesUploaded(collab) &&
      this.areAllSlidesUploaded(collab) &&
      this.areAllCameraClipsUploaded(collab)
    );
  }

  static areAllImagesUploaded(collab: CollabRecord): boolean {
    return collab.images.every(
      (item) => item.uploadStatus === FileStatus.Uploaded
    );
  }

  static areAllSlidesUploaded(collab: CollabRecord): boolean {
    return collab.slides.every(
      (item) => item.uploadStatus === FileStatus.Uploaded
    );
  }

  static areAllCameraClipsUploaded(collab: CollabRecord): boolean {
    return collab.cameraClips.every(
      (item) => item.uploadStatus === FileStatus.Uploaded
    );
  }

  static areAllAudiosUploaded(collab: CollabRecord): boolean {
    return collab.audios.every(
      (item) => item.uploadStatus === FileStatus.Uploaded
    );
  }
}
