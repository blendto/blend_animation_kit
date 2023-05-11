import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { HeroImageIdBased } from "server/service/fileKeysProcessingStrategy";
import RecoEngineApi from "server/internal/reco-engine";
import { plainToClass } from "class-transformer";
import { BlendHeroImage } from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import Joi from "joi";
import { MethodNotAllowedError } from "../../../../server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(chooseHeroImage, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const CHOOSE_HERO_IMAGE_SCHEMA = Joi.object({
  heroImageId: Joi.string().required(),
});

const chooseHeroImage = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);

  const { id } = req.query as { id: string };

  const requestBody = req.body as { heroImageId: string };

  validate(
    requestBody,
    requestComponentToValidate.body,
    CHOOSE_HERO_IMAGE_SCHEMA
  );

  const { heroImageId } = req.body as { heroImageId: string };
  const fileKeys = await new HeroImageIdBased(
    heroImageId,
    id,
    req.uid
  ).process();

  const blend = await blendService.getBlend(id);

  const recoEngineApi = new RecoEngineApi();
  const classificationMetadata = await recoEngineApi.detectProductCategory(
    req,
    {
      original: fileKeys.original,
      withoutBg: fileKeys.withoutBg,
    }
  );

  const blendHeroImage = plainToClass(BlendHeroImage, {
    ...fileKeys,
    heroImageId,
    classificationMetadata,
  });

  await blendService.addOrUpdateImageFileKeys(blend, blendHeroImage, {
    isHeroImage: true,
  });

  res.send(blend.heroImages);
};
