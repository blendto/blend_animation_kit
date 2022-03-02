import VesApi from "server/internal/ves";
import type { NextApiRequest, NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import firebase from "server/external/firebase";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return generatePreview(req, res);
      default:
        res.status(405).end();
    }
  }
);

const vesapi = new VesApi();

const generatePreview = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
    body: { recipeId },
  } = req;

  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const batchId = id as string;

  let fileKeys = await service.selectFileKeysFromBatchPreview(uid, batchId);
  const previewStream = await vesapi.preview({
    recipeId: recipeId,
    fileKeys: {
      original: fileKeys.original,
      withoutBg: fileKeys.withoutBg,
    },
  });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
