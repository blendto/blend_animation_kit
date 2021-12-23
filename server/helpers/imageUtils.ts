import sharp from "sharp";

export const applyMask = async (
  image: Buffer,
  mask: Buffer
): Promise<Buffer> => {
  return sharp(image).joinChannel(mask).png().toBuffer();
};

export const rescaleImage = (image: Buffer, width: number, height: number) => {
  return sharp(image).resize({ width, height }).toBuffer();
};
