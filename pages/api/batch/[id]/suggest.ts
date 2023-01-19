import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(suggestBatchRecipes, req, res);
      default:
        res.status(405).end();
    }
  }
);

const suggestBatchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const { ip } = req;
  const batchId = id as string;

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);

  const recipeLists = await service.suggestBatchRecipes(
    req.buildVersion,
    req.uid,
    batchId,
    ip
  );
  return res.status(200).json(recipeLists);
};
