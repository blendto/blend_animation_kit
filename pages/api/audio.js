import { ServerError, UserError } from "../../server/base/errors";
import { createSignedUploadUrl } from "../../server/external/s3uploader";

const VALID_EXTENSIONS = ["webm", "pcm", "mp4"];

const MAX_FILE_SIZE = 25 * 1024 * 1024; //25 Mb

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
    const urlDetails = await createSignedUploadUrl(
      req,
      VALID_EXTENSIONS,
      MAX_FILE_SIZE
    );
    res.send(urlDetails);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ message: err.message });
      return;
    }
    res.status(500).json({ message: err.message });
  }
};
