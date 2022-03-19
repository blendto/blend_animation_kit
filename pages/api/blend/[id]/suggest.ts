import type { NextApiResponse } from "next";
import { Blend } from "server/base/models/blend";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { SuggestionService } from "server/service/suggestion";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { FileKeysProcessingStrategy } from "server/service/fileKeysProcessingStrategy";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return suggestRecipes(req, res);
      default:
        res.status(405).end();
    }
  }
);

interface SuggestRecipesRequestBody {
  fileKeys: HeroImageFileKeys;
  multipleAspectRatios?: boolean;
  heroImageId?: string;
}

const suggestRecipes = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
    body,
  } = req;

  const { fileKeys, multipleAspectRatios, heroImageId } =
    body as SuggestRecipesRequestBody;

  const blend: Blend = await diContainer
    .get<BlendService>(TYPES.BlendService)
    .getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (
    !heroImageId &&
    (!fileKeys || typeof fileKeys != "object" || !fileKeys.original)
  ) {
    res.status(400).send({ message: "Invalid filekeys / heroImageId" });
    return;
  }

  const ip = req.headers["x-forwarded-for"] as string;

  const fileKeysProcessor = FileKeysProcessingStrategy.choose(
    id as string,
    req.uid,
    fileKeys,
    heroImageId
  );

  const finalisedFileKeys: HeroImageFileKeys =
    await fileKeysProcessor.process();

  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  await blendService.addHeroKeysToBlend(blend.id, finalisedFileKeys);
  const suggestions = await diContainer
    .get<SuggestionService>(TYPES.SuggestionService)
    .suggestRecipes(
      req.uid,
      finalisedFileKeys.withoutBg,
      ip,
      multipleAspectRatios
    );

  return res.send({
    fileKeys: finalisedFileKeys,
    suggestedRecipes: suggestions.randomTemplates,
    otherRecipes: suggestions.recipeLists,
  });
};
