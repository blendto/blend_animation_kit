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
