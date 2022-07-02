import sharp from "sharp";
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-var-requires,@typescript-eslint/no-unsafe-assignment
const heicConvert = require("heic-convert");

export async function sharpInstance(
  input?: Buffer,
  options?: sharp.SharpOptions
): Promise<sharp.Sharp> {
  const converted = await convertToValidFormat(input);
  return sharp(converted, options);
}

async function convertToValidFormat(input: Buffer): Promise<Buffer> {
  const metadata = await sharp(input).metadata();
  if (metadata.format === "heif") {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return (await heicConvert({
      buffer: input,
      format: "JPEG",
    })) as Buffer;
  }
  return input;
}
