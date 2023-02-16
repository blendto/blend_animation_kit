import { sharpInstance } from "server/helpers/sharpUtils";
import {
  trimmedImageBuffer,
  getTargetDimensions,
} from "server/helpers/imageUtils";
import { MAX_IMAGE_DIMENSION } from "./constants";

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

  it("Ensure image resize target dimensions return correct results", () => {
    const smallImageDimensions = { width: 123, height: 456 };
    const targetDimensionsForSmall = getTargetDimensions(
      smallImageDimensions.width,
      smallImageDimensions.height,
      MAX_IMAGE_DIMENSION
    );
    expect(targetDimensionsForSmall[0]).toEqual(smallImageDimensions.width);
    expect(targetDimensionsForSmall[1]).toEqual(smallImageDimensions.height);

    const bigImageDimensions = { width: 3000, height: 6000 };
    const targetDimensionsForBig = getTargetDimensions(
      bigImageDimensions.width,
      bigImageDimensions.height,
      MAX_IMAGE_DIMENSION
    );
    // expected results: width = (3000 * 4000/6000) = 2000, height = (6000 * 4000/6000) = 4000
    expect(targetDimensionsForBig[0]).toEqual(2000);
    expect(targetDimensionsForBig[1]).toEqual(4000);
  });
});
