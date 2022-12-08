import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
  requestComponentToValidate,
  validate,
} from "server/helpers/request";
import BrandingService from "server/service/branding";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse): Promise<void> => {
    const { method } = req;
    switch (method) {
      case "POST":
        return await ensureAuth(addRecipe, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const ADD_BODY_SCHEMA = Joi.object({
  sourceBlendId: Joi.string().required(),
  heroAssetUid: Joi.string(),
  backgroundAssetUid: Joi.string(),
});

async function addRecipe(
  req: NextApiRequestExtended,
  res: NextApiResponse
): Promise<void> {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    ADD_BODY_SCHEMA
  );
  const { sourceBlendId, heroAssetUid, backgroundAssetUid } = req.body as {
    sourceBlendId: string;
    heroAssetUid: string;
    backgroundAssetUid: string;
  };

  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  res
    .status(201)
    .send(
      await brandingService.addRecipe(
        req.uid,
        sourceBlendId,
        heroAssetUid,
        backgroundAssetUid
      )
    );
}
