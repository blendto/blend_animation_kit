import VesApi from "server/internal/ves";
import { handleServerExceptions } from "server/base/errors";
import type { NextApiRequest, NextApiResponse } from "next";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await generatePreview(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const vesapi = new VesApi();

const generatePreview = async (req: NextApiRequest, res: NextApiResponse) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { body } = req;

  return handleServerExceptions(res, async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const previewStream = await vesapi.preview(body);
    res.setHeader("Content-Type", "image/jpeg");
    res.send(previewStream);
  });
};
