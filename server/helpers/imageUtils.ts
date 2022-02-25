import sharp from "sharp";

const TRIM_THRESHOLD = 10;

interface SharpResolveObject {
  data: Buffer;
  info: sharp.OutputInfo;
}

export const applyMask = async (
  image: Buffer,
  mask: Buffer,
  trim: boolean
): Promise<SharpResolveObject> => {
  const output = await sharp(image)
    .rotate()
    .joinChannel(mask)
    .png()
    .toBuffer({ resolveWithObject: true });

  if (!trim) {
    return output;
  }

  return sharp(output.data)
    .trim(TRIM_THRESHOLD)
    .toBuffer({ resolveWithObject: true });
};

export const rescaleImage = (image: Buffer, width: number, height?: number) =>
  sharp(image).resize({ width, height }).toBuffer();
