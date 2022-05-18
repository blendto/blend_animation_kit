import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { NextApiResponse } from "next";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { RecipeService } from "server/service/recipe";
import { MethodNotAllowedError } from "server/base/errors";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return saveRecipeThumbnail(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const saveRecipeThumbnail = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id } = req.query as { id: string };
  const { variant } = req.body as { variant: string };

  const service = diContainer.get<RecipeService>(TYPES.RecipeService);
  await service.saveRecipeThumbnail(id, variant);
  res.status(200).end();
};
