import VesApi from "server/internal/ves";
import type { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
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

const generatePreview = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body: { recipeId, variant },
  } = req;
  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const batchId = id as string;

  let fileKeys = await service.selectFileKeysFromBatchPreview(req.uid, batchId);
  const previewStream = await vesapi.preview({
    recipeId: recipeId,
    variant: variant,
    fileKeys: {
      original: fileKeys.original,
      withoutBg: fileKeys.withoutBg,
    },
  });
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
