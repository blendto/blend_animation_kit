import { NextApiRequest, NextApiResponse } from "next";
import { diContainer } from "../../../../inversify.config";
import { TYPES } from "../../../../server/types";
import Firebase from "../../../../server/external/firebase";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  switch (method) {
    case "POST":
      await loginFakeUser(req, res);
      break;
    default:
      res.status(405).json({ code: 405, message: `${method} not supported` });
  }
};

const loginFakeUser = async (req: NextApiRequest, res: NextApiResponse) => {
  const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);
  const userCredential = await firebaseService.loginFakeUser();

  res.status(200).send(userCredential);
};
