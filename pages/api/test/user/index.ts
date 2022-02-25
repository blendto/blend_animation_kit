import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  switch (method) {
    case "POST":
      await createTemporaryTestUser(req, res);
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

const createTemporaryTestUser = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const userCredential = await firebase.createTemporaryUser();
  res.status(200).send(userCredential);
};
