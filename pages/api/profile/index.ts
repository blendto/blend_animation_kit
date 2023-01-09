import Joi from "joi";
import type { NextApiResponse } from "next";
import { UserJSONUpdate, UserService } from "server/service/user";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { UserUpdatePaths } from "server/repositories/user";
import { UpdateOperations } from "server/repositories";
import {
  ensureAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { QueueConfig } from "server/external/queue";
import { UserAccountActionQueue } from "server/external/queue/userAccountActionQueue";
import { UserAccountActionType } from "server/base/models/queue-messages";
import BrandingService from "server/service/branding";
import { FlowType } from "../../../server/base/models/recipe";
import { FavouriteRecipe } from "../../../server/base/models/user";

const BUILD_V_BEFORE_START_WITH_TEMPLATE = 470;
export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;

    switch (method) {
      case "GET":
        await ensureAuth(getProfile, req, res);
        break;
      case "PATCH":
        await ensureAuth(updateProfile, req, res);
        break;
      case "DELETE":
        await ensureAuth(deleteProfile, req, res);
        break;
      default:
        res.status(400).json({ code: 400, message: "Invalid request" });
    }
  }
);

const filterOutNonAssistedFlowRecipes = (
  favRecipes: FavouriteRecipe[]
): FavouriteRecipe[] =>
  favRecipes.filter(
    (rec) =>
      !rec.fullRecipe.extra.applicableFor ||
      rec.fullRecipe.extra.applicableFor.length === 0 ||
      rec.fullRecipe.extra.applicableFor.some((flow) =>
        [
          FlowType.BATCH,
          FlowType.ASSISTED_MOBILE,
          FlowType.ASSISTED_WEB,
        ].includes(flow)
      )
  );

const getProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userService = diContainer.get<UserService>(TYPES.UserService);
  const brandingService = diContainer.get<BrandingService>(
    TYPES.BrandingService
  );
  const profile = await userService.getOrCreate(req.uid);
  delete profile.appleOfflineToken;
  if (req.buildVersion <= BUILD_V_BEFORE_START_WITH_TEMPLATE) {
    profile.favouriteRecipes = filterOutNonAssistedFlowRecipes(
      profile.favouriteRecipes
    );
  }
  return res.json({
    ...profile,
    branding: await brandingService.getOrCreate(req.uid),
  });
};

const UPDATE_BODY_SCHEMA = Joi.object({
  changes: Joi.array()
    .items(
      Joi.object({
        path: Joi.string()
          .required()
          .valid(...Object.values(UserUpdatePaths)),
        op: Joi.string()
          .required()
          .valid(...Object.values(UpdateOperations)),
        value: Joi.any().when("op", {
          not: "remove",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .required()
    .min(1),
});

const updateProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    UPDATE_BODY_SCHEMA
  );

  const userService = diContainer.get<UserService>(TYPES.UserService);
  const profile = await userService.update(
    req.uid,
    (req.body as { changes: UserJSONUpdate[] }).changes
  );
  delete profile.appleOfflineToken;
  res.send(profile);
};

const deleteProfile = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const userAccountActionQueue = diContainer.get<
    UserAccountActionQueue<QueueConfig>
  >(TYPES.UserAccountActionQueue);
  await userAccountActionQueue.writeMessage({
    action: UserAccountActionType.DELETE,
    userId: req.uid,
  });
  res.status(202).end();
};
