import { NextApiResponse } from "next";

import UserError from "./UserError";
import ServerError from "./ServerError";
import ObjectNotFoundError from "./ObjectNotFoundError";

const handleServerExceptions = async (
  res: NextApiResponse,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorThrowingFunction: (...args: any) => Promise<any>
) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await errorThrowingFunction();
  } catch (err) {
    if (err instanceof UserError) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

export { ObjectNotFoundError, ServerError, UserError, handleServerExceptions };
