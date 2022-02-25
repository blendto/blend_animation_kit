import { ServerError, UserError } from "server/base/errors";
import { AxiosError, AxiosResponse } from "axios";
import { NextApiRequest, NextApiResponse } from "next";

export const handleAxiosCall = async <ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>
) => {
  try {
    return await axiosCall();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (error.isAxiosError) {
      error as AxiosError;
      const { status } = (error as AxiosError).response;
      if (status >= 400 && status < 500) {
        throw new UserError((error as AxiosError).response.data);
      }
      /* eslint-disable-next-line
        @typescript-eslint/restrict-template-expressions,
        @typescript-eslint/no-unsafe-member-access
      */
      console.info(`Axios called failed with message: ${error.message}`);
      throw new ServerError("Something went wrong");
    }
    console.error(error);
    throw new ServerError("Something went wrong");
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PassThroughableFn = (query: any, body: any) => Promise<any>;

export const passthrough = async (
  req: NextApiRequest,
  res: NextApiResponse,
  fn: PassThroughableFn
) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const responseData = await fn(req.query, req.body);

    res.send(responseData);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ message: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};
