import { NextApiResponse } from "next";
import { ObjectNotFoundError, UserError, ServerError } from "./index";

export const handleServerExceptions = async (
  res: NextApiResponse,
  errorThrowingFunction: (...args: any) => Promise<any>
) => {
  try {
    return await errorThrowingFunction();
  } catch (err) {
    if (err instanceof UserError) {
      return res.status(400).send({ message: err.message, code: err.code });
    } else if (err instanceof ObjectNotFoundError) {
      return res.status(404).send({ message: err.message });
    } else if (err instanceof ServerError) {
      return res.status(500).send({ message: "Something went wrong!" });
    }
    console.error(err);
    return res.status(500).send({ message: "Something went wrong!" });
  }
};
