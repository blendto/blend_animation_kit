import {
  BrandingLogoStatus,
  brandingRepo,
  BrandingStatus,
  BrandingUpdateOperations,
  BrandingUpdatePaths,
  BrandingEntity,
} from "./branding";

describe("BrandingRepo", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("updateWithFormatted", () => {
    it("transforms patch on logos.primaryEntry into patch on the whole logos map", async () => {
      const id = "wNALVbEj";
      const userId = "uxFJ2pRfNeMtfOO1dH5UhHKQbah2";
      const updatedAt = 1646906641;
      const status = BrandingStatus.CREATED;
      const fileKey1 = "FILE-KEY-1";
      const fileKey2 = "FILE-KEY-2";
      const brandingProfile = {
        id,
        userId,
        logos: {
          entries: [
            { fileKey: fileKey1, status: BrandingLogoStatus.UPLOADED },
            { fileKey: fileKey2, status: BrandingLogoStatus.UPLOADED },
          ],
          primaryEntry: fileKey1,
        },
        updatedAt,
        status,
      } as BrandingEntity;

      const modelUpdateSpy = jest
        .spyOn(brandingRepo, "update")
        .mockResolvedValueOnce(brandingProfile);
      await brandingRepo.updateWithFormatted(brandingProfile, [
        {
          op: BrandingUpdateOperations.replace,
          path: BrandingUpdatePaths.primaryLogo,
          value: fileKey2,
        },
      ]);

      expect(modelUpdateSpy.mock.calls.length).toBe(1);
      expect(modelUpdateSpy.mock.calls[0]).toMatchObject([
        { id },
        [
          {
            op: BrandingUpdateOperations.replace,
            path: "/logos",
            value: {
              entries: [
                { fileKey: fileKey1, status: BrandingLogoStatus.UPLOADED },
                { fileKey: fileKey2, status: BrandingLogoStatus.UPLOADED },
              ],
              primaryEntry: fileKey2,
            },
          },
        ],
      ]);
    });
  });
});
