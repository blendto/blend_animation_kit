import sharp from "sharp";
import { ImageMetadata, Interaction } from "server/base/models/recipe";
import { getObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";

const TRIM_THRESHOLD = 10;

interface SharpResolveObject {
  data: Buffer;
  info: sharp.OutputInfo;
}

export const applyMask = async (
  image: Buffer,
  mask: Buffer,
  trim: Boolean = true
): Promise<SharpResolveObject> => {
  const output = await sharp(image)
    .rotate()
    .joinChannel(mask)
    .png()
    .toBuffer({ resolveWithObject: true });

  if (!trim) {
    return output;
  }

  return await sharp(output.data)
    .trim(TRIM_THRESHOLD)
    .toBuffer({ resolveWithObject: true });
};

export const rescaleImage = (image: Buffer, width: number, height?: number) => {
  return sharp(image).resize({ width, height }).toBuffer();
};

/**
 *
 * Modifies the interaction's metadata to ensure that the image has a tight bounds
 * This adjust the recipe's hero image bounds to the target images bounds so taht
 * there is no extra area.
 *
 * @param interaction Interaction to be updated
 * @param fileKey The s3 filekey for the image
 */
export const adjustSizeToFit = async (
  interaction: Interaction,
  fileKey: string
) => {
  const imageFile = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    fileKey
  );

  const imageFileMetadata = await sharp(imageFile).metadata();

  let { width, height } = imageFileMetadata;

  if ([5, 6, 7, 8].includes(imageFileMetadata.orientation)) {
    // 5, 6, 7, 8 orientation represents 90 or 270 degree rotated
    const temp = width;
    width = height;
    height = temp;
  }

  const metadata = interaction.metadata as ImageMetadata;
  const scale = Math.min(
    metadata.size.width / width,
    metadata.size.height / height
  );
  const targetSize = {
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
  };
  const widthDiff = metadata.size.width - targetSize.width;
  const heightDiff = metadata.size.height - targetSize.height;
  metadata.position = {
    dx: metadata.position.dx + widthDiff / 2,
    dy: metadata.position.dy + heightDiff / 2,
  };
  metadata.size = targetSize;
};
