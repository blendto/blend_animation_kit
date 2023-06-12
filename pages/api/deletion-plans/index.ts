import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  NextApiRequestExtended,
  ensureServiceAuth,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import { ProjectsFrictionService } from "server/service/projects-friction-service";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.AWSTriggerHandlers,
          createDeletionPlan,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const CREATE_BODY_SCHEMA = Joi.object({
  userId: Joi.string().required(),
  encoderVersion: Joi.number().required(),
});

async function createDeletionPlan(
  req: NextApiRequestExtended,
  res: NextApiResponse
) {
  const { userId, encoderVersion } = validate(
    req.body as object,
    requestComponentToValidate.body,
    CREATE_BODY_SCHEMA
  ) as {
    userId: string;
    encoderVersion: number;
  };
  const projectsFrictionService = diContainer.get<ProjectsFrictionService>(
    TYPES.ProjectsFrictionService
  );
  await projectsFrictionService.createDeletionPlan(userId, encoderVersion);
  res.status(204).end();
}
