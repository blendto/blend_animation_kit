import { UserError } from "server/base/errors";
import { AxiosError, AxiosResponse } from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import logger from "server/base/Logger";

export const handleAxiosCall = async function <ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>
) {
  try {
    return await axiosCall();
  } catch (error) {
    if (error.isAxiosError) {
      error as AxiosError;
      const { status } = (error as AxiosError).response as AxiosResponse<any>;
      if (status >= 400 && status < 500) {
        throw new UserError((error as AxiosError).response.data);
      }
      logger.info("Axios called failed with message: " + error.message);
      throw error;
    }
    logger.error(error);
    throw error;
  }
};

type PassThroughableFn = (query: any, body: any) => Promise<any>;

export const passthrough = async function (
  req: NextApiRequest,
  res: NextApiResponse,
  fn: PassThroughableFn
) {
  try {
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
};
