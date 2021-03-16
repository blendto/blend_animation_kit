import VesApi from "server/internal/ves";
import { handleNetworkExceptions } from "../../../../server/base/errors/Handlers";

export default async (req, res) => {
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

const generatePreview = async (req, res) => {
  const { body } = req;

  return await handleNetworkExceptions(res, async () => {
    const previewStream = await vesapi.preview(body);
    res.setHeader("Content-Type", "image/jpeg");
    res.send(previewStream);
  });
};
