import logger from "server/base/Logger";

interface Options {
  operationName?: string;
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
  func: () => Promise<any>,
  options?: Options
) => {
  try {
    await func();
  } catch (ex) {
    logger.error({
      op: options?.operationName ?? "UNNAMED_FIRE_AND_FORGET_OP",
      exception: ex,
    });
  }
};
