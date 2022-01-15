import { EncodedPageKey } from "./paginationUtils";

const data = {
  sample1: {
    original: {
      uid: "sjzszjszszszsijz8jenz9e9m*j",
    },
    encoded: "eyJ1aWQiOiJzanpzempzenN6c3pzaWp6OGplbno5ZTltKmoifQ==",
  },
  sample2: {
    original: {
      uid: null,
    },
    encoded: "eyJ1aWQiOm51bGx9",
  },
};

describe("encodePageKey", () => {
  it("Objects encoded correctly", () => {
    const testData = data.sample1;
    const testData2 = data.sample2;

    const encodedPageKey = EncodedPageKey.fromObject(testData.original);
    const encodedPageKey2 = EncodedPageKey.fromObject(testData2.original);

    expect(encodedPageKey.key).toMatch(testData.encoded);
    expect(encodedPageKey2.key).toMatch(testData2.encoded);
  });

  it("Objects decoded correctly", () => {
    const testData = data.sample1;
    const testData2 = data.sample2;

    const encodedPageKey = new EncodedPageKey(testData.encoded);
    const encodedPageKey2 = new EncodedPageKey(testData2.encoded);

    expect(encodedPageKey.decode()).toMatchObject(testData.original);
    expect(encodedPageKey2.decode()).toMatchObject(testData2.original);
  });

  it("validations", () => {
    expect(new EncodedPageKey(null).isValid()).toEqual(false);
    expect(new EncodedPageKey(true).isValid()).toEqual(false);
    expect(new EncodedPageKey({ key: "val" }).isValid()).toEqual(false);

    expect(new EncodedPageKey("true").isValid()).toEqual(true);
    expect(new EncodedPageKey("null").isValid()).toEqual(true);
    expect(new EncodedPageKey("some string").isValid()).toEqual(true);
  });

  it("existence tests", () => {
    expect(new EncodedPageKey(null).exists()).toEqual(false);
    expect(new EncodedPageKey("null").exists()).toEqual(false);

    expect(new EncodedPageKey(true).exists()).toEqual(true);
    expect(new EncodedPageKey({ key: "val" }).exists()).toEqual(true);
    expect(new EncodedPageKey("true").exists()).toEqual(true);
    expect(new EncodedPageKey("some string").exists()).toEqual(true);
  });
});
