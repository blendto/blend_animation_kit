// noinspection DuplicatedCode

// TODO: Duplicate of `pages/api/batch/[id]/suggest.ts`.
//       keep this and remove `pages/api/batch/[id]/suggest.ts`
//       when old batch code is removed
import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(suggestBatchRecipes, req, res);
      default:
        throw new MethodNotAllowedError();
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

  return res.send(recipeLists);
};
