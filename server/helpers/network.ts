import { ServerError, UserError } from "server/base/errors";
import { AxiosError, AxiosResponse } from "axios";

export const handleAxiosCall = async function <ResponseDataType>(
  axiosCall: () => Promise<AxiosResponse<ResponseDataType>>
) {
  try {
    return axiosCall();
  } catch (error) {
    if (error.response) {
      const { status } = error.response;
      if (status >= 400 && status < 500) {
        throw new UserError(error.message);
      }
      console.info("Axios called failed with message: " + error.message);
      throw new ServerError("Something went wrong");
    }
    console.error(error);
    throw new ServerError("Something went wrong");
  }
};
