import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return suggestBatchRecipes(req, res);
      default:
        res.status(405).end();
    }
  }
);

const suggestBatchRecipes = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });
  const {
    query: { id },
  } = req;

  const ip = req.headers["x-forwarded-for"] as string;
  const batchId = id as string;

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);

  const recipeLists = await service.suggestBatchRecipes(uid, batchId, ip);
  return res.status(200).json(recipeLists);
};
