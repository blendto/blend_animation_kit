import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
import { handleServerExceptions } from "server/base/errors";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  return handleServerExceptions(res, async () => {
    const { method } = req;
    try {
      switch (method) {
        case "GET":
          return getHero(req, res);

        case "DELETE":
          return deleteHero(req, res);

        default:
          res.status(405).end();
      }
    } catch (err) {
      console.error({
        op: err.toString(),
        message: err.toString(),
      });
      res.status(500).json({ message: "Something went wrong!" });
    }
  });
};

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
