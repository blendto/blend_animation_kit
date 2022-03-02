import VesApi from "server/internal/ves";
import type { NextApiRequest, NextApiResponse } from "next";
import withErrorHandler from "request-handler";

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return generatePreview(req, res);
      default:
        res.status(405).end();
    }
  }
);

const vesapi = new VesApi();

const generatePreview = async (req: NextApiRequest, res: NextApiResponse) => {
  const { body } = req;
  const previewStream = await vesapi.preview(body);
  res.setHeader("Content-Type", "image/jpeg");
  res.send(previewStream);
};
