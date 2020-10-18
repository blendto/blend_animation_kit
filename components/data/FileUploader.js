//@flow
import type { FileType } from "../data/EditorContext";

const apiPath = (fileType: FileType) => {
  switch (fileType) {
    case "AUDIO":
      return "/api/audio";
    case "CAMERA_CLIP":
      return "/api/cameraClip";
    case "IMAGE":
      return "/api/image";
    case "SLIDE":
      return "/api/slide";
    default:
      throw new Error(`Unknown fileType: ${fileType}`);
  }
};

export default class FileUploader {
  static async uploadFileToS3(
    collabId: string,
    file: File | Blob,
    fileType: FileType,
    fileName: ?string
  ) {
    let apiUrlPath = apiPath(fileType);
    if (!(file instanceof File) && !fileName?.trim()) {
      throw new Error("fileName required if blob is passed");
    }
    return new Promise(async (resolve, reject) => {
      const createUrlParams = {
        collabId,
        fileName: fileName || file.name,
      };

      try {
        const urlDetails = await fetch(apiUrlPath, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createUrlParams),
        }).then((response) => {
          if (!response.ok) {
            throw new Error(response.message);
          }
          return response.json();
        });

        const formData = new FormData();
        Object.keys(urlDetails.fields).forEach((key) =>
          formData.append(key, urlDetails.fields[key])
        );
        formData.append("file", file);

        const s3Response = await fetch(urlDetails.url, {
          method: "POST",
          body: formData,
        }).then((response) => {
          if (!response.ok) {
            throw new Error(response.message);
          }
          return response;
        });

        resolve({ fileKey: urlDetails.fields.key });
      } catch (ex) {
        console.error(ex);
        reject(ex.message ?? "Something went wrong");
      }
    });
  }
}
