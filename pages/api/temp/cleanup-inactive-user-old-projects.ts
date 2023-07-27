import { diContainer } from "inversify.config";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import { fireAndForget } from "server/helpers/async-runner";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import { ProjectsFrictionService } from "server/service/projects-friction-service";
import { TYPES } from "server/types";

export default withReqHandler(
  (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return cleanupOldProjects(req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

function cleanupOldProjects(req: NextApiRequestExtended, res: NextApiResponse) {
  const projectsFrictionService = diContainer.get<ProjectsFrictionService>(
    TYPES.ProjectsFrictionService
  );
  const { userId } = req.body as { userId: string };
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  fireAndForget(() => projectsFrictionService.cleanupOldProjects(userId), {
    operationName: "projectsFrictionService.cleanupOldProjects",
  });
  res.end();
}
