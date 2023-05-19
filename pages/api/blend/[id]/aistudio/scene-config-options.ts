import type { NextApiResponse } from "next";

import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";
import { MethodNotAllowedError } from "server/base/errors";
import {
  SceneConfigOptionsExternal,
  ScenePerspective,
} from "server/base/models/aistudio";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getSceneConfigOptions, req, res);
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const getSceneConfigOptions = (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const out: SceneConfigOptionsExternal = {
    perspective: ScenePerspective.TOP_VIEW,
    backgroundList: [
      {
        id: "bg-kitchen",
        thumbnail: "",
        label: {},
        localisedLabel: "Kitchen",
      },
      {
        id: "bg-studio",
        thumbnail: "",
        label: {},
        localisedLabel: "Studio",
      },
    ],
    surfaceList: [
      {
        id: "surface-table",
        thumbnail: "",
        label: {},
        localisedLabel: "Wooden Table",
      },
      {
        id: "surface-platform",
        thumbnail: "",
        label: {},
        localisedLabel: "Wooden Platform",
      },
    ],
  };
  res.send(out);
};
