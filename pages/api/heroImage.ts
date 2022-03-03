import type { NextApiResponse } from "next";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import HeroImageService from "server/service/heroImage";
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
        return ensureAuth(getHeroes, req, res);
      default:
        res.status(405).end();
    }
  }
);

async function getHeroes(req: NextApiRequestExtended, res: NextApiResponse) {
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
    .getImagesForUser(pageKeyObject, req.uid);
  const nextPageToken = EncodedPageKey.fromObject(nextPageKeyObject)?.key;
  res.send({ data: images, nextPageToken });
}
