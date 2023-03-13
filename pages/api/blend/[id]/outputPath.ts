import { NextApiResponse } from "next";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import {
  ForbiddenError,
  MethodNotAllowedError,
  ObjectNotFoundError,
  UserError,
  UserErrorCode,
} from "server/base/errors";
import { Blend } from "server/base/models/blend";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import { ElementSource } from "server/base/models/recipe";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureServiceAuth(
          BlendMicroServices.CataloguesService,
          getBlendOutputPath,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

const getBlendOutputPath = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const { id, format, userId } = req.query as {
    id: string;
    format: string;
    userId: string;
  };
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const blend: Blend = await blendService.getBlend(id, true);
  if (!blend) {
    throw new ObjectNotFoundError();
  }
  if (blend.createdBy !== userId) {
    throw new ForbiddenError();
  }
  if (!blend.output.image?.path) {
    throw new UserError(
      "Output image path not found",
      UserErrorCode.NON_GENERATED_BLEND
    );
  }
  if (format && format.toLowerCase() === "url") {
    res.send({
      url: `${ConfigProvider.NEXT_PUBLIC_OUTPUT_BASE_PATH}${blend.output.image.path}`,
    });
  } else {
    res.send({
      source: ElementSource.blend_output,
      path: blend.output.image.path,
    });
  }
};
