import sharp from "sharp";
import { ValidImageExtension } from "./constants";
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const heicConvert = require("heic-convert");

export async function sharpInstance(
  input?: Buffer,
  options?: sharp.SharpOptions,
  fileExtension?: ValidImageExtension
): Promise<sharp.Sharp> {
  if (!input) {
    return sharp(options);
  }
  const converted = await convertToValidFormat(input, fileExtension);
  return sharp(converted, options);
}

async function convertToValidFormat(
  input: Buffer,
  fileExtension?: ValidImageExtension
): Promise<Buffer> {
  const metadata = await sharp(input).metadata();
  if (metadata.format === "heif") {
    // sharp returns avif metadata as heif, so make sure it's actually heif
    // or if image extension is not provided, we just trust the metadata
    if (!fileExtension || ["heic", "heif"].includes(fileExtension)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return (await heicConvert({
        buffer: input,
        format: "JPEG",
      })) as Buffer;
    }
    return await sharp(input).toFormat("jpeg").toBuffer();
  }
  return input;
}
