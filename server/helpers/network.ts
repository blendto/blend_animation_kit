import { UserError } from "server/base/errors";
import { AxiosError, AxiosResponse } from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";

export async function handleAxiosCall<ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>
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
          errMessage = JSON.stringify(errMessage);
        }
        throw new UserError(errMessage as string);
      }
      logger.error(
        `Axios call failed with message: ${(error as AxiosError).message}`
      );
      throw error;
    }
    logger.error(error);
    throw error;
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
      logger.error(`Axios call failed with message: ${error.message}`);
      throw new Error(error.message);
    }
    throw error;
  }
}

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
