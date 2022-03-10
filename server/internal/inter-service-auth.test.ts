import { diContainer } from "inversify.config";
import { UnauthorizedError, UserError } from "server/base/errors";
import { TYPES } from "server/types";
import InterServiceAuth, { BlendMicroServices } from "./inter-service-auth";

const CORRECT_TOKEN = "abcd";
const INVALID_TOKEN = "zyx";

describe("Tests Interservice Auth", () => {
  const service = diContainer.get<InterServiceAuth>(TYPES.InterServiceAuth);

  describe("getToken method", () => {
    it("fetches the right token for the service", async () => {
      jest.spyOn(service, "fetchApiKeys").mockResolvedValue({
        [BlendMicroServices.AWSTriggerHandlers]: CORRECT_TOKEN,
      });
      await expect(
        service.getToken(BlendMicroServices.AWSTriggerHandlers)
      ).resolves.toBe(CORRECT_TOKEN);
    });

    it("Throws an error if a key for the service is not found", async () => {
      jest.spyOn(service, "fetchApiKeys").mockResolvedValue({});
      await expect(
        service.getToken(BlendMicroServices.AWSTriggerHandlers)
      ).rejects.toThrow("API Key for Service not found");
    });
  });

  describe("validate method", () => {
    let getTokenSpy: jest.SpyInstance;

    beforeAll(() => {
      getTokenSpy = jest
        .spyOn(service, "getToken")
        .mockResolvedValue(CORRECT_TOKEN);
    });

    beforeEach(() => {
      getTokenSpy.mockClear();
    });

    it("executes without error if the token is valid", async () => {
      await expect(
        service.validate(BlendMicroServices.AWSTriggerHandlers, CORRECT_TOKEN)
      ).resolves.not.toThrowError();
      expect(getTokenSpy.mock.calls.length).toBe(1);
    });

    it("throws and error if the token is invalid", async () => {
      await expect(
        service.validate(BlendMicroServices.AWSTriggerHandlers, INVALID_TOKEN)
      ).rejects.toThrow(UnauthorizedError);
      expect(getTokenSpy.mock.calls.length).toBe(1);
    });

    it("throws an error if token is null/undefined", async () => {
      await expect(
        service.validate(BlendMicroServices.AWSTriggerHandlers)
      ).rejects.toThrow(UnauthorizedError);
      await expect(
        service.validate(BlendMicroServices.AWSTriggerHandlers, null)
      ).rejects.toThrow(UnauthorizedError);
      await expect(
        service.validate(BlendMicroServices.AWSTriggerHandlers, undefined)
      ).rejects.toThrow(UnauthorizedError);
      expect(getTokenSpy.mock.calls.length).toBe(0);
    });
  });
});
