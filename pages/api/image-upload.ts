import { NextApiRequest, NextApiResponse } from "next";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { createSignedUploadUrl } from "server/external/s3";
import { initMiddleware } from "server/helpers/middleware";
import Cors from "cors";

// Initializing the cors middleware
const cors = Cors({
  methods: ["POST", "OPTIONS"],
});

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const corsmiddleware = initMiddleware(cors);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await corsmiddleware(req, res);

  const { method } = req;

  switch (method) {
    case "POST":
      await uploadImage(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

interface UploadFileRequest {
  fileName: string;
}

const uploadImage = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const { fileName } = req.body as UploadFileRequest;

    const urlDetails = await createSignedUploadUrl(
      fileName,
      ConfigProvider.WEB_USER_ASSETS_BUCKET,
      VALID_EXTENSIONS,
      {
        maxSize: MAX_FILE_SIZE,
      }
    );
    res.send(urlDetails);
  } catch (err) {
    if (err instanceof UserError) {
      res.status(400).json({ message: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};
