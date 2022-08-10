import { sharpInstance } from "server/helpers/sharpUtils";
import { trimmedImageBuffer } from "server/helpers/imageUtils";

describe("imageUtils", () => {
  it("Ensure trim of image with all pixels same is no-op", async () => {
    const sharp = await sharpInstance(null, {
      create: {
        width: 5,
        height: 5,
        channels: 3,
        background: "red",
      },
    });
    const { info } = await trimmedImageBuffer(sharp);

    const { width, height, trimOffsetTop, trimOffsetLeft } = info;
    expect(width).toEqual(5);
    expect(height).toEqual(5);
    expect(trimOffsetTop).toEqual(undefined);
    expect(trimOffsetLeft).toEqual(undefined);
  });
});
