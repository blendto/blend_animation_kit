import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getHero(req, res);

      case "DELETE":
        return deleteHero(req, res);

      default:
        res.status(405).end();
    }
  }
);

const getHero = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
  });

  const {
    query: { id },
  } = req;

  res.send(
    await diContainer
      .get<HeroImageService>(TYPES.HeroImageService)
      .getImage(id as string, uid)
  );
};

const deleteHero = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
  });

  const {
    query: { id },
  } = req;

  await diContainer
    .get<HeroImageService>(TYPES.HeroImageService)
    .deleteImage(id as string, uid);
  res.status(204).end();
};
