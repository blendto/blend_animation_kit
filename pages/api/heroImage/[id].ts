import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { DynamoBasedServiceLocator, IServiceLocator } from "server/service";
import HeroImageService from "server/service/heroImage";
import { handleServerExceptions } from "server/base/errors";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  return handleServerExceptions(res, async () => {
    const { method } = req;
    const serviceLocator = DynamoBasedServiceLocator.instance;
    try {
      switch (method) {
        case "GET":
          return getHero(req, res, serviceLocator);

        case "DELETE":
          return deleteHero(req, res, serviceLocator);

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

const getHero = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
  });

  const {
    query: { id },
  } = req;

  res.send(
    await serviceLocator.find(HeroImageService).getImage(id as string, uid)
  );
};

const deleteHero = async (
  req: NextApiRequest,
  res: NextApiResponse,
  serviceLocator: IServiceLocator
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
  });

  const {
    query: { id },
  } = req;

  await serviceLocator.find(HeroImageService).deleteImage(id as string, uid);
  res.status(204).end();
};
