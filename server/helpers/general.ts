export async function withExponentialBackoffRetries<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: {
    fnArgs?: unknown[];
    backOffFactorInMS: number;
    maxRetries?: number;
  }
): Promise<T> {
  const { fnArgs = [], backOffFactorInMS, maxRetries = 2 } = options;

  let retriesDone = 0;
  let error: Error;
  while (retriesDone <= maxRetries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn(...fnArgs);
    } catch (e) {
      error = e as Error;
      // eslint-disable-next-line no-await-in-loop, no-loop-func
      await new Promise((resolve) => {
        setTimeout(resolve, backOffFactorInMS * 2 ** retriesDone);
      });
      retriesDone += 1;
    }
  }
  throw error;
}
