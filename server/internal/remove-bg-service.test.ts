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
});
