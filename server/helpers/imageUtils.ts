import sharp from "sharp";
import { ImageMetadata, Interaction } from "server/base/models/recipe";
import { getObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { UserError } from "server/base/errors";
import { sharpInstance } from "server/helpers/sharpUtils";

const TRIM_THRESHOLD = 10;

interface SharpResolveObject {
  data: Buffer;
  info: sharp.OutputInfo;
}

interface BlankImageGenerateArgs {
  height: number;
  width: number;
  backgroundColor: string;
}

export const generateBlankImage = async (
  options: BlankImageGenerateArgs
): Promise<Buffer> =>
  await sharp({
    create: {
      channels: 3,
      height: options.height,
      width: options.width,
      background: options.backgroundColor,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

export const extractAlphaMaskFromImage = async (
  image: Buffer
): Promise<Buffer> =>
  (await sharpInstance(image))
    .extractChannel("alpha")
    .png({ compressionLevel: 9 })
    .toBuffer();

export const applyMask = async (
  image: Buffer,
  mask: Buffer,
  trim = true
): Promise<SharpResolveObject> => {
  let sharpInst = await sharpInstance(image);
  const metadata = await sharpInst.metadata();

  if (metadata.hasAlpha) {
    sharpInst = sharp(await sharpInst.removeAlpha().toBuffer());
  }

  const output = sharpInst.rotate().joinChannel(mask);

  if (!trim) {
    return output.toBuffer({ resolveWithObject: true });
  }
  const img = await output.png({ compressionLevel: 0 }).toBuffer();

  return (await sharpInstance(img))
    .trim(TRIM_THRESHOLD)
    .toBuffer({ resolveWithObject: true });
};

// Keep default quality same as sharp, 80
export const convertImageToWebp = async (image: Buffer, quality = 80) => {
  // failOnError: false helps blow past errors like
  // "VipsJpeg: Invalid SOS parameters for sequential JPEG"
  // https://github.com/lovell/sharp/issues/1578
  const sharpInst = await sharpInstance(image, { failOnError: false });
  return await sharpInst.toFormat("webp", { quality }).toBuffer();
};

export const rescaleImage = async (
  image: Buffer,
  options: {
    width: number;
    height?: number;
    withoutEnlargement?: boolean;
  }
) => await (await sharpInstance(image)).resize(options).toBuffer();

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

  const imageFileMetadata = await (await sharpInstance(imageFile)).metadata();

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

export const readImageMetadata = async (image: Buffer) => {
  try {
    return await sharp(image).metadata();
  } catch (ex: unknown) {
    logger.warn({
      error: ex instanceof Error ? ex.toString() : "Unable to process image",
    });
    throw new UserError("Unable to process image", "unprocessable-image");
  }
};
