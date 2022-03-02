import firebase from "server/external/firebase";
import type { NextApiRequest, NextApiResponse } from "next";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return getHeroes(req, res);
      default:
        res.status(405).end();
    }
  }
);

const getHeroes = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  const {
    query: { pageToken },
  } = req;

  let pageKeyObject = null;
  const encodedPageKey = new EncodedPageKey(pageToken);
  if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
    return res.status(400).json({ message: "pageToken should be a string" });
  }
  try {
    pageKeyObject = encodedPageKey.decode();
  } catch (e) {
    return res.status(400).json({ message: "Invalid pageToken format" });
  }

  const { images, pageKeyObject: nextPageKeyObject } = await diContainer
    .get<HeroImageService>(TYPES.HeroImageService)
    .getImagesForUser(pageKeyObject, uid);
  const nextPageToken = EncodedPageKey.fromObject(nextPageKeyObject)?.key;
  res.send({ data: images, nextPageToken });
};
