import { ALL_SUPPORTED_EXTENSIONS } from "server/helpers/constants";
import logger from "server/base/Logger";

export const extractExtensionFromFileKey = (fileKey: string): string =>
  fileKey.split(".").pop();

export const extractFileKeyWithoutExtension = (fileKey: string): string => {
  const strings = fileKey.split(".");
  return strings.length < 2 ? fileKey : strings.slice(0, -1).join(".");
};

export function addSuffixToFileKey(
  fileKey: string,
  suffix: string,
  extension?: string
): string {
  if (!extension) extension = extractExtensionFromFileKey(fileKey);
  const fileKeyWithoutExt = extractFileKeyWithoutExtension(fileKey);
  return `${fileKeyWithoutExt}${suffix}.${extension}`;
}

export function replaceUriPrefix(uri: string, newPrefix: string): string {
  const uriParts = uri.split("/");
  uriParts[0] = newPrefix;
  return uriParts.join("/");
}

export function extractCorrectedFileName(fileName: string): string {
  let fileNameCorrected = fileName;
  const fileNameArr = fileName.split(".");
  let extension = fileNameArr.pop().toLowerCase();

  if (fileNameArr.length > 0) {
    // Find the first valid extension that matches the file extension
    // Note: The order of VALID_UPLOAD_IMAGE_EXTENSIONS is important for this to work correctly,
    //           for instance, "jpe" should come after "jpeg"
    for (let i = 0; i < ALL_SUPPORTED_EXTENSIONS.length; i++) {
      const validExt = ALL_SUPPORTED_EXTENSIONS[i];
      if (extension.startsWith(validExt)) {
        if (extension !== validExt) {
          logger.info(`changing extension from ${extension} to ${validExt}`);
        }
        extension = validExt;
        fileNameCorrected = `${fileNameArr.join(".")}.${extension}`;
        break;
      }
    }
  }
  return fileNameCorrected;
}
