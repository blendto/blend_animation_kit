import { UserError } from "server/base/errors";
import { AxiosError, AxiosResponse } from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";
import ExternalHTTPError from "server/base/errors/ExternalHTTPError";
import { pick } from "lodash";
import { isNetworkError } from "axios-retry";

export async function handleAxiosCall<ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>,
  logLevel: "warn" | "error" = "error"
) {
  try {
    return await axiosCall();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.isAxiosError) {
      const { status } = (error as AxiosError).response;
      if (status >= 400 && status < 500) {
        let errMessage: unknown = (error as AxiosError).response.data;
        if (typeof errMessage === "object") {
          errMessage =
            (errMessage as { message: string })?.message ??
            JSON.stringify(errMessage);
        }
        throw new UserError(errMessage as string);
      }
    }
    const extra = pick((error as AxiosError).config || {}, [
      "baseURL",
      "url",
      "data",
    ]);
    throw new ExternalHTTPError((error as Error).message, extra, logLevel);
  }
}

export async function handleInternalAxiosCall<ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>
) {
  try {
    return await handleAxiosCall<ResponseDataType>(axiosCall);
  } catch (error) {
    // Internal call failures should always be a 500
    if (error instanceof UserError) {
      logger.warn({ op: "AXIOS_CALL_FAILED", message: error.message });
      throw new Error(error.message);
    }
    throw error;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PassThroughableFn = (query: any, body: any) => Promise<any>;

export async function passthrough(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: PassThroughableFn
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseData = await fn(req.query, req.body);

    res.send(responseData);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ message: err.message });
      return;
    }
    logger.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
}

export function axiosRetryCondition(error: AxiosError): boolean {
  return (
    isNetworkError(error) &&
    (!error.response ||
      (error.response.status >= 500 && error.response.status <= 599))
  );
}
