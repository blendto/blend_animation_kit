/**
 * @jest-environment node
 */
import { readFileSync } from "fs";
import { RemoveBgService } from "./remove-bg-service";

describe("validating image format", () => {
  it("throws an exception when invalid image buffer is passed", async () => {
    const validation = RemoveBgService.validateImage(Buffer.from([1, 2, 3]));
    await expect(validation).rejects.toThrowError(
      "Input buffer contains unsupported image format"
    );
  });

  it("does not throw an exception when valid image buffer is passed", async () => {
    const validImageBuffer = readFileSync("__tests__/assets/small-png.png");
    const validation = RemoveBgService.validateImage(validImageBuffer);
    await expect(validation).resolves.toBe(undefined);
  });

  it("does not throw an exception when valid heic image buffer is passed", async () => {
    const validImageBuffer = readFileSync("__tests__/assets/sample-heic.heic");
    const validation = RemoveBgService.validateImage(validImageBuffer);
    await expect(validation).resolves.toBe(undefined);
  });

  it("does not throw an exception when valid avif image and extension buffer is passed", async () => {
    const validImageBuffer = readFileSync("__tests__/assets/sample_avif.avif");
    const validation = RemoveBgService.validateImage(validImageBuffer, "avif");
    await expect(validation).resolves.toBe(undefined);
  });

  it("constructs file names properly for files with extension", () => {
    const fileKey = "foobar/red-shoe.jpg";
    const { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);
    expect(bgRemovedFileKey).toStrictEqual("foobar/red-shoe-bg-removed.png");
    expect(bgMaskFileKey).toStrictEqual("foobar/red-shoe-bg-mask.png");
    expect(fileNameWithExt).toStrictEqual("red-shoe.jpg");
  });

  it("constructs file names properly for files without extension", () => {
    const fileKey = "foobar/red-shoe";
    const { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);
    expect(bgRemovedFileKey).toStrictEqual("foobar/red-shoe-bg-removed.png");
    expect(bgMaskFileKey).toStrictEqual("foobar/red-shoe-bg-mask.png");
    expect(fileNameWithExt).toStrictEqual("red-shoe");
  });

  it("constructs file names properly for files with multiple . in filename", () => {
    const fileKey = "foobar/shoe.red.jpg";
    const { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);
    expect(bgRemovedFileKey).toStrictEqual("foobar/shoe.red-bg-removed.png");
    expect(bgMaskFileKey).toStrictEqual("foobar/shoe.red-bg-mask.png");
    expect(fileNameWithExt).toStrictEqual("shoe.red.jpg");
  });
});
