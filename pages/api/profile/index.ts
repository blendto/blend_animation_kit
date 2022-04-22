import type { NextApiResponse } from "next";
import { UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "GET":
        await ensureAuth(getProfile, req, res);
        break;
      default:
        res.status(400).json({ code: 400, message: "Invalid request" });
    }
  }
);

const getProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  let profile = await userService.fetchUser(req.uid);
  if (profile) {
    return res.json(profile);
  }
  profile = await userService.populateUserFromFirebase(req.uid);
  return res.json(profile);
};
