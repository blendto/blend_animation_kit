import logger from "server/base/Logger";

interface Options {
  operationName?: string;
  context?: Record<string, unknown>;
}

/**
 * Used to fire and forget async operations without blocking the request.
 * await or return any async operation called inside the function. Do not miss await inside it.
 *
 * Good:
 * 1. fireAndForget(() => asyncOpThatReturnsPromise())
 * 2. fireAndForget(() => { return asyncOpThatReturnsPromise() });
 *
 *
 * Bad:
 * 1. fireAndForget(() => {
 *      anotherAsyncOperationDefinedWithoutAwait();
 *      return asyncOpThatReturnsPromise()
 * });
 *
 *
 * @param func function that wraps async operations
 * @param options
 */
export const fireAndForget = async (
  func: () => Promise<unknown>,
  options?: Options
) => {
  try {
    await func();
  } catch (ex) {
    logger.error({
      op: options?.operationName ?? "UNNAMED_FIRE_AND_FORGET_OP",
      context: options?.context ?? {},
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      exception: ex,
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
      message: ex?.message,
    });
  }
};
