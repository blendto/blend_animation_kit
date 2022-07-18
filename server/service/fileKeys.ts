import { IService } from "server/service";
import { injectable } from "inversify";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import { Blend } from "server/base/models/blend";
import { getObject, uploadObject } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { extractAlphaMaskFromImage } from "server/helpers/imageUtils";
import { addSuffixToFileKey } from "server/helpers/fileKeyUtils";
import { bufferToStream } from "server/helpers/bufferUtils";

@injectable()
export default class FileKeysService implements IService {
  // Required as class attributes for mocking
  uploadObject = uploadObject;
  getObject = getObject;

  async extractBgMaskAndUpload(fileKey: string): Promise<string> {
    const bgRemovedImage = await this.getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKey
    );
    const maskImage = await extractAlphaMaskFromImage(bgRemovedImage);
    const bgMaskFileKey = addSuffixToFileKey(fileKey, "-bg-mask", "png");
    await this.uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgMaskFileKey,
      bufferToStream(maskImage)
    );
    return bgMaskFileKey;
  }

  constructUpdatedFileKeysFromBlend(
    blend: Blend,
    imageFileKey: HeroImageFileKeys
  ): HeroImageFileKeys[] {
    const imageFileKeys = blend.imageFileKeys ?? [];

    const index = imageFileKeys.findIndex(
      (fileKeyItem) => fileKeyItem.original === imageFileKey.original
    );

    if (index === -1) {
      imageFileKeys.push(imageFileKey);
    } else {
      imageFileKeys[index] = imageFileKey;
    }
    return imageFileKeys;
  }

  retrieveFileKeyItemFromBlend(
    blend: Blend,
    fileKey: string
  ): HeroImageFileKeys | undefined {
    const { imageFileKeys, heroImages } = blend;

    if (
      heroImages &&
      [heroImages.withoutBg, heroImages.original].includes(fileKey)
    ) {
      return heroImages;
    }

    return imageFileKeys?.find((fileKeysItem) =>
      [fileKeysItem.withoutBg, fileKeysItem.original].includes(fileKey)
    );
  }
}
