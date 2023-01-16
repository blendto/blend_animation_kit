import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "../../../server/base/errors";
import { diContainer } from "../../../inversify.config";
import { TYPES } from "../../../server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "../../../server/helpers/request";
import { NonHeroRecipeListService } from "../../../server/service/nonHeroRecipeList";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getRecipeLists, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getRecipeLists = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const nonHeroRecipeListService = diContainer.get<NonHeroRecipeListService>(
    TYPES.NonHeroRecipeListService
  );
  const {
    query: { pageKey },
  } = req;
  const ip = req.headers["x-forwarded-for"] as string;
  const recipeListsPage = await nonHeroRecipeListService.getAll(
    pageKey as string,
    req.uid,
    ip
  );
  res.send(recipeListsPage);
};
