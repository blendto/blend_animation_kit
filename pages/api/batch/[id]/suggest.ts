import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import { handleServerExceptions } from "server/base/errors";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  handleServerExceptions(res, async () => {
    switch (method) {
      case "POST":
        await suggestBatchRecipes(req, res);
        break;
      default:
        res.status(500).json({ code: 500, message: "Something went wrong!" });
    }
  });
};

const suggestBatchRecipes = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  let uid = await firebase.extractUserIdFromRequest({
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
