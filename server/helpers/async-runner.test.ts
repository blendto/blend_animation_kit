import logger from "server/base/Logger";
import { fireAndForget } from "./async-runner";

describe("ensure that fireAndForget handles async methods correctly", () => {
  it("async non error throwing function works fine", async () => {
    const loggerErrorMock = jest
      .spyOn(logger, "error")
      .mockImplementation(() => null);
    const successfulFunction = () => {
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 50);
      });
    };
    const wrappingMethod = fireAndForget(() => successfulFunction());

    await expect(wrappingMethod).resolves.toBeUndefined();
    expect(loggerErrorMock).not.toBeCalled();
  });

  it("async errors from the target function are gracefully handled", async () => {
    const loggerErrorMock = jest
      .spyOn(logger, "error")
      .mockImplementation(() => null);
    const errorThrowingFunction = () => {
      return new Promise((resolve, reject) => {
        setTimeout(() => reject(), 50);
      });
    };
    const wrappingMethod = fireAndForget(() => errorThrowingFunction());

    await expect(wrappingMethod).resolves.toBeUndefined();
    expect(loggerErrorMock.mock.calls.length).toBe(1);
    expect((loggerErrorMock.mock.calls[0][0] as { op; exception }).op).toBe(
      "UNNAMED_FIRE_AND_FORGET_OP"
    );
  });
});
