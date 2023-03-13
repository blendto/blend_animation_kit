import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
import {
  NextApiRequestExtended,
  ensureAuth,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getHero, req, res);

      case "DELETE":
        return ensureAuth(deleteHero, req, res);

      default:
        res.status(405).end();
    }
  }
);

const getHero = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const {
    query: { id },
  } = req;

  res.send(
    await diContainer
      .get<HeroImageService>(TYPES.HeroImageService)
      .getImage(id as string, req.uid)
  );
};

const deleteHero = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  await diContainer
    .get<HeroImageService>(TYPES.HeroImageService)
    .deleteImage(id as string, req.uid);
  res.status(204).end();
};
