import VesApi from "server/internal/ves";
import { handleServerExceptions } from "server/base/errors/Handlers";
import type { NextApiRequest, NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import firebase from "server/external/firebase";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await generatePreview(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const vesapi = new VesApi();

const generatePreview = async (req: NextApiRequest, res: NextApiResponse) => {
  const {
    query: { id },
    body: { recipeId },
  } = req;

  return await handleServerExceptions(res, async () => {
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
  });
};
