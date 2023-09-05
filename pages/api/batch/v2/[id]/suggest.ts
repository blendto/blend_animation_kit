// noinspection DuplicatedCode

// TODO: Duplicate of `pages/api/batch/[id]/suggest.ts`.
//       keep this and remove `pages/api/batch/[id]/suggest.ts`
//       when old batch code is removed
import { NextApiResponse } from "next";
import Joi from "joi";

import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { FlowType } from "server/base/models/recipe";

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

const requestSchema = Joi.object({
  id: Joi.string().required(),
  flow: Joi.string()
    .optional()
    .valid(FlowType.BATCH, FlowType.BATCH_360)
    .default(FlowType.BATCH),
});

const suggestBatchRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id: batchId, flow } = validate(
    req.query,
    requestComponentToValidate.query,
    requestSchema
  ) as { id: string; flow?: FlowType };

  const { ip } = req;

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);

  const recipeLists = await service.suggestBatchRecipes(
    req.buildVersion,
    req.uid,
    batchId,
    ip,
    flow
  );

  return res.send(recipeLists);
};
