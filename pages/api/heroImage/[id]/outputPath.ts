import { NextApiResponse } from "next";
import Joi from "joi";
import { diContainer } from "inversify.config";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import { TYPES } from "server/types";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import HeroImageService, { ImagePathFormat } from "server/service/heroImage";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureServiceAuth(
          BlendMicroServices.CataloguesService,
          getHeroOutputPath,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

const GET_QUERY = Joi.object({
  id: Joi.string().required(),
  format: Joi.string()
    .lowercase()
    .valid(...Object.values(ImagePathFormat))
    .default(ImagePathFormat.FILEKEY),
  userId: Joi.string().required(),
});

const getHeroOutputPath = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const query = validate(
    req.query as object,
    requestComponentToValidate.query,
    GET_QUERY
  );
  const { id, format, userId } = query as {
    id: string;
    format: ImagePathFormat;
    userId: string;
  };
  res.send(
    await diContainer
      .get<HeroImageService>(TYPES.HeroImageService)
      .getImagePath({ id, userId, format })
  );
};
