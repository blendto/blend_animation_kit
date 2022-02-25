/* eslint-disable import/no-unresolved */
import { UserError } from "server/base/errors";
import { createSignedUploadUrl } from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export default async (req, res) => {
  const { method } = req;

  switch (method) {
    case "POST":
      await uploadImage(req, res);
      break;
    default:
      res.status(500).json({ code: 500, message: "Something went wrong!" });
  }
};

const uploadImage = async (req, res) => {
  try {
    const { body: uploadFileRequest } = req;

    const { collabId, fileName } = uploadFileRequest;

    if (!collabId) {
      throw new UserError("No collabId found in the request");
    }

    const urlDetails = await createSignedUploadUrl(
      fileName,
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      VALID_EXTENSIONS,
      {
        keyPrefix: `${collabId}/`,
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
