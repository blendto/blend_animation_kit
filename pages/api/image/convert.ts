import fs from "fs";
import { promisify } from "util";
import { NextApiResponse } from "next";
import {
  AuthType,
  ensureServiceAuth,
  NextApiRequestExtended,
  parseIncomingForm,
  withReqHandler,
} from "../../../server/helpers/request";
import { BlendMicroServices } from "../../../server/internal/inter-service-auth";
import { MethodNotAllowedError, UserError } from "../../../server/base/errors";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "../../../server/helpers/constants";
import { sharpInstance } from "../../../server/helpers/sharpUtils";
import {
  convertUnspportedFormatToWebp,
  rescaleImage,
} from "../../../server/helpers/imageUtils";

const readFile = promisify(fs.readFile);
export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.CataloguesService,
          convertIncomingImage,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  },
  AuthType.SERVICE
);

export const config = {
  api: {
    bodyParser: false,
  },
};

const convertIncomingImage = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const uploadData = await parseIncomingForm(req);
  if (!uploadData.files?.file?.[0] || !uploadData.fields?.fileName?.[0]) {
    throw new UserError(
      "form data must contain a 'file' image file and a 'fileName' field"
    );
  }
  const fileName: string = uploadData.fields.fileName[0];
  const { path } = uploadData.files.file[0];
  const imageBuffer = await readFile(path);
  let converted: Buffer;
  const fileNameArr: string[] = fileName.split(".");
  if (fileNameArr.length <= 1) {
    // no extension. Try to convert using sharp and hope for the best
    converted = await (await sharpInstance(imageBuffer))
      .toFormat("webp")
      .toBuffer();
  } else {
    const fileExtension = fileNameArr.pop();
    if (VALID_UPLOAD_IMAGE_EXTENSIONS.includes(fileExtension)) {
      converted = await (await sharpInstance(imageBuffer, {}, fileExtension))
        .toFormat("webp")
        .toBuffer();
    } else {
      converted = await convertUnspportedFormatToWebp(imageBuffer, fileName);
    }
  }
  const optimized = await rescaleImage(converted, {
    width: 720,
    withoutEnlargement: true,
  });
  res.setHeader("Content-Type", "image/webp");
  return res.send(optimized);
};
