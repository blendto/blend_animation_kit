import firebase from "server/external/firebase";
import type { NextApiRequest, NextApiResponse } from "next";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  try {
    switch (method) {
      case "GET":
        await getHeroes(req, res);
        break;

      default:
        res.status(404).json({ code: 404, message: "Invalid request" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

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
