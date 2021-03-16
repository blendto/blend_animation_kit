import { NextApiResponse } from "next";
import ServerError from "./ServerError";
import UserError from "./UserError";

export const handleNetworkExceptions = async (
  res: NextApiResponse,
  errorThrowingFunction: (...args: any) => Promise<any>
) => {
  try {
    return await errorThrowingFunction();
  } catch (err) {
    if (err instanceof UserError) {
      return res.status(400).send({ message: err.message });
    } else if (err instanceof ServerError) {
      return res.status(500).send({ message: "Something went wrong!" });
    }
    console.error(err);
    return res.status(500).send({ message: "Something went wrong!" });
  }
};
