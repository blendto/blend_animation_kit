import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  NextApiRequestExtended,
  ensureAuth,
  withReqHandler,
} from "server/helpers/request";
import {
  DeletionPlanStatus,
  ProjectsFrictionService,
} from "server/service/projects-friction-service";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getPendingDeletionPlan, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function getPendingDeletionPlan(
  req: NextApiRequestExtended,
  res: NextApiResponse
) {
  const projectsFrictionService = diContainer.get<ProjectsFrictionService>(
    TYPES.ProjectsFrictionService
  );
  const lastCreated = await projectsFrictionService.getLastCreatedDeletionPlan(
    req.uid
  );
  res.send({
    pendingPlan:
      lastCreated?.status === DeletionPlanStatus.PENDING ? lastCreated : null,
  });
}
