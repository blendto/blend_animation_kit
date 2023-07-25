import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { ProjectsFrictionService } from "server/service/projects-friction-service";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return cleanupOldProjects(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

async function cleanupOldProjects(
  req: NextApiRequestExtended,
  res: NextApiResponse
) {
  const projectsFrictionService = diContainer.get<ProjectsFrictionService>(
    TYPES.ProjectsFrictionService
  );
  const { userId } = req.body as { userId: string };
  await projectsFrictionService.cleanupOldProjects(userId);
  res.end();
}
