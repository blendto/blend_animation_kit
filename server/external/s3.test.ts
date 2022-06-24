import { createDestinationFileKey } from "./s3";

describe("createDestinationFileKey", () => {
  it("processes properly for normal image files", () => {
    const fileKey = createDestinationFileKey("red-shoe.jpg", ["jpg", "png"]);

    expect(fileKey).toMatch(/(.+).jpg/);
  });

  it("add prefix when provided", () => {
    const fileKey = createDestinationFileKey(
      "red-shoe.jpg",
      ["jpg", "png"],
      "foobar"
    );

    expect(fileKey).toMatch(/foobar(.+).jpg/);
  });

  it("works when there is no file extension", () => {
    const fileKey = createDestinationFileKey(
      "red-shoe",
      ["jpg", "png"],
      "foobar"
    );

    expect(fileKey).toMatch(/foobar(.+)/);
  });

  it("throws when there is an incompatible file extension", () => {
    const invokeFnWithBadFileExt = () =>
      createDestinationFileKey("red-shoe.pdf", ["jpg", "png"], "foobar");

    expect(invokeFnWithBadFileExt).toThrow();
  });
});
