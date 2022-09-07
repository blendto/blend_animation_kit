import type { NextApiResponse } from "next";
import { Blend } from "server/base/models/blend";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { BlendService } from "server/service/blend";
import { SuggestionService } from "server/service/suggestion";
import { SuggestRecipesPaginatedRequestBody } from "server/base/models/recipe";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { FileKeysProcessingStrategy } from "server/service/fileKeysProcessingStrategy";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureAuth(suggestRecipesV2, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const suggestRecipesV2 = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const {
    query: { id },
  } = req;

  const { fileKeys, pageKey, heroImageId } =
    req.body as SuggestRecipesPaginatedRequestBody;

  const blend: Blend = await diContainer
    .get<BlendService>(TYPES.BlendService)
    .getBlend(id as string);

  if (!blend) {
    res.status(400).send({ message: "Blend not found!" });
    return;
  }

  if (
    !heroImageId &&
    (!fileKeys || typeof fileKeys !== "object" || !fileKeys.original)
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
  await blendService.addOrUpdateImageFileKeys(blend, finalisedFileKeys, {
    isHeroImage: true,
  });

  const suggestionService = diContainer.get<SuggestionService>(
    TYPES.SuggestionService
  );

  const suggestions = await suggestionService.suggestRecipesPaginated(
    req.uid,
    finalisedFileKeys.withoutBg,
    ip,
    pageKey
  );

  const promises = suggestions.recipeLists.map((recipeList) =>
    suggestionService.recipeListMapper(recipeList)
  );

  const recipeLists = await Promise.all(promises);

  return res.send({
    fileKeys: finalisedFileKeys,
    suggestedRecipes: recipeLists,
    nextPageKey: suggestions.nextPageKey,
  });
};
