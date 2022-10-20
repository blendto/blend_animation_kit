import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import FileKeysService from "server/service/fileKeys";
import ConfigProvider from "server/base/ConfigProvider";
import sharp from "sharp";
import { Stream } from "stream";
import { Blend } from "server/base/models/blend";
import { ImageFileKeys } from "server/base/models/heroImage";

describe("FileKeys Service", () => {
  const fileKeysService = diContainer.get<FileKeysService>(
    TYPES.FileKeysService
  );

  const fileKey = "Bnyldj7K/PFJmJA1G5U-9BpNohsPga-bg-removed.png";
  const imageFileKeys = [
    {
      withoutBg: "Bnyldj7K/PFJmJA1G5U-9BpNohsPga-bg-removed.png",
      original: "Bnyldj7K/PFJmJA1G5U-9BpNohsPga.png",
      mask: "Bnyldj7K/PFJmJA1G5U-9BpNohsPga-bg-mask.png",
    },
  ] as ImageFileKeys[];

  const generateFakeBlend = () =>
    ({
      imageFileKeys: JSON.parse(
        JSON.stringify(imageFileKeys)
      ) as ImageFileKeys[],
      heroImages: {
        withoutBg: "Bnyldj7K/hero-bg-removed.png",
        original: "Bnyldj7K/hero.png",
        mask: "Bnyldj7K/hero-mask.png",
      },
    } as Blend);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Extract Background Mask and upload", () => {
    it("extracting mask image and returning file key", async () => {
      const fakeImage = await sharp({
        create: {
          channels: 4,
          height: 100,
          width: 100,
          background: "white",
        },
      })
        .png()
        .toBuffer();

      const getItemSpy = jest
        .spyOn(fileKeysService, "getObject")
        .mockResolvedValueOnce(fakeImage);
      const uploadObjectSpy = jest
        .spyOn(fileKeysService, "uploadObject")
        .mockResolvedValue(null);

      const maskFileKey = await fileKeysService.extractBgMaskAndUpload(fileKey);
      expect(getItemSpy.mock.calls.length).toBe(1);
      expect(getItemSpy).toHaveBeenLastCalledWith(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        fileKey
      );
      expect(uploadObjectSpy.mock.calls.length).toBe(1);
      expect(uploadObjectSpy).toHaveBeenLastCalledWith(
        ConfigProvider.BLEND_INGREDIENTS_BUCKET,
        maskFileKey,
        expect.any(Stream)
      );
    });
  });

  describe("Construct Updated FileKeys", () => {
    it("Should update fileKey Item if already exists", () => {
      const updatedFileKeyItem = {
        ...imageFileKeys[0],
        withoutBg: "Bnyldj7K/PFJmJA1G5U-9BpNohsPga-new-bg-removed.png",
        mask: "Bnyldj7K/PFJmJA1G5U-9BpNohsPga-new-bg-mask.png",
      };

      const updatedFileKeys = fileKeysService.constructUpdatedFileKeysFromBlend(
        generateFakeBlend(),
        updatedFileKeyItem
      );
      expect(updatedFileKeys.length).toBe(imageFileKeys.length);
      expect(updatedFileKeys).not.toEqual(imageFileKeys);
      expect(updatedFileKeys).toContain(updatedFileKeyItem);
    });

    it("Should append fileKey Item if does not already exists", () => {
      const newFileKeyItem = {
        withoutBg: "Bnyldj7K/another-image-bg-removed.png",
        original: "Bnyldj7K/another-image.png",
        mask: "Bnyldj7K/another-image-bg-mask.png",
      };

      const updatedFileKeys = fileKeysService.constructUpdatedFileKeysFromBlend(
        generateFakeBlend(),
        newFileKeyItem
      );
      expect(updatedFileKeys.length).toBe(imageFileKeys.length + 1);
      expect(updatedFileKeys).not.toEqual(imageFileKeys);
      expect(updatedFileKeys).toContain(newFileKeyItem);
    });
  });

  describe("Retrieve file Key", () => {
    it("Return fileKey item if exist", () => {
      const blend = generateFakeBlend();
      const fileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
        blend,
        fileKey
      );
      expect(fileKeyItem).not.toBeFalsy();
      expect(blend.imageFileKeys).toContain(fileKeyItem);
    });

    it("Return undefined if not exist", () => {
      const fileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
        generateFakeBlend(),
        "some-non-existing-filekey.png"
      );
      expect(fileKeyItem).toBe(undefined);
    });

    it("Return heroImage if filekey is heroImage", () => {
      const blend = generateFakeBlend();
      const fileKeyItem = fileKeysService.retrieveFileKeyItemFromBlend(
        blend,
        "Bnyldj7K/hero.png"
      );
      expect(fileKeyItem).not.toBeFalsy();
      expect(blend.heroImages).toMatchObject(fileKeyItem);
    });
  });
});
