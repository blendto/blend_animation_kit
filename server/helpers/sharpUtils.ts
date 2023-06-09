import sharp from "sharp";
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const heicConvert = require("heic-convert");

export async function sharpInstance(
  input?: Buffer,
  options?: sharp.SharpOptions,
  fileExtension?: string
): Promise<sharp.Sharp> {
  options = options ?? {};
  options.failOnError = false;
  if (!input) {
    return sharp(options);
  }
  const converted = await convertToValidFormat(input, fileExtension);
  return (
    sharp(converted, options)
      // Retain orientation based on original EXIF data
      .rotate()
  );
}

async function convertToValidFormat(
  input: Buffer,
  fileExtension?: string
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
