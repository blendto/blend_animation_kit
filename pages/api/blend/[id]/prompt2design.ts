import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  NextApiRequestExtended,
  ensureAuth,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";

import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { SuggestionService } from "server/service/suggestion";
import { P2DCreationLogAction } from "server/base/models/p2d";
import { P2DCreationLogRepository } from "server/repositories/p2d-creation-log";
import { fireAndForget } from "server/helpers/async-runner";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(createCustomTemplates, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const REQUEST_SCHEMA = Joi.object({
  textPrompt: Joi.string().required().trim(),
  userChosenSuperClass: Joi.string().optional().allow(null),
});

const createCustomTemplates = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };

  const { ip } = req;

  const requestBody = req.body as {
    textPrompt: string;
    userChosenSuperClass?: string;
  };
  const validatedBody = validate(
    requestBody,
    requestComponentToValidate.body,
    REQUEST_SCHEMA
  ) as { textPrompt: string };

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  const validSuggestions = await suggestionService.prompt2design({
    id,
    prompt: validatedBody.textPrompt,
    ip,
    uid: req.uid,
    buildVersion: req.buildVersion,
  });

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fireAndForget(
    () =>
      diContainer.get<P2DCreationLogRepository>(TYPES.P2DCreationLogRepo).log({
        userId: req.uid,
        prompt: validatedBody.textPrompt,
        suggestions: validSuggestions,
        blendId: id,
        action: P2DCreationLogAction.SUGGEST,
      }),
    { operationName: "prompt2design-suggest" }
  );

  res.send({
    id: "custom",
    title: "Custom Templates",
    recipes: validSuggestions,
  });
};
