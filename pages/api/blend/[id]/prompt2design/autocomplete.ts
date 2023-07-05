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

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(autocomplete, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const REQUEST_SCHEMA = Joi.object({
  textPrompt: Joi.string().required().trim(),
});

const autocomplete = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const requestBody = req.body as {
    textPrompt: string;
  };

  const validatedBody = validate(
    requestBody,
    requestComponentToValidate.body,
    REQUEST_SCHEMA
  ) as { textPrompt: string };

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  res.send({
    options: [
      await suggestionService.autocompletePrompt({
        prompt: validatedBody.textPrompt,
      }),
    ],
  });
};
