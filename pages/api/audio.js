import { ServerError, UserError } from "../../server/base/errors";
import { uploadTempUserContent } from "../../server/external/s3uploader";

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await uploadAudio(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const uploadAudio = async (req, res) => {
  try {
    const fileDetails = await uploadTempUserContent(req);
    res.send(fileDetails);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

export const config = {
  api: {
    bodyParser: false,
  },
};
