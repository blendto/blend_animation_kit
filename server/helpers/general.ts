export async function withExponentialBackoffRetries<T>(
  fn: (...args: unknown[]) => Promise<T>,
  fnArgs: unknown[] = [],
  backOffFactor = 0.5,
  retriesDone = 0,
  maxRetries = 2
): Promise<T> {
  let error: Error;
  while (retriesDone <= maxRetries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(...fnArgs);
    } catch (e) {
      error = e as Error;
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      await new Promise((resolve) => {
        setTimeout(resolve, backOffFactor * 2 ** retriesDone);
      });
      retriesDone += 1;
    }
  }
  throw error;
}
