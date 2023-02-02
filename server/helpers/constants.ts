export const VALID_UPLOAD_IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "heic",
  "heif",
  "avif",
  "tiff",
  "dng",
  "gif",
  "jfif",
  "jpe",
] as const;

export type ValidImageExtension = typeof VALID_UPLOAD_IMAGE_EXTENSIONS[number];
