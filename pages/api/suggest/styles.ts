import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { SuggestionService } from "server/service/suggestion";
import { TYPES } from "server/types";
import { MethodNotAllowedError } from "server/base/errors";
import {
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import Joi from "joi";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return suggestStyles(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const SUGGEST_QUERY_SCHEMA = Joi.object({
  fileKey: Joi.string().required(),
});

const suggestStyles = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  validate(
    req.query as object,
    requestComponentToValidate.query,
    SUGGEST_QUERY_SCHEMA
  );

  const service = diContainer.get<SuggestionService>(TYPES.SuggestionService);
  const ip = req.headers["x-forwarded-for"] as string;
  const { fileKey } = req.query as { fileKey: string };
  const recipeSuggestions = await service.suggestStyles(fileKey, ip);
  res.send(recipeSuggestions);
};
