import { IncomingForm } from "formidable";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";

const TEMP_FILE_STORE_BUCKET = "collabice-temp-file-store";

const TEMP_WEB_BASE_URL =
  "https://collabice-temp-file-store.s3.us-east-2.amazonaws.com/";

var AWS = require("aws-sdk");

const fileOptions = {
  multiple: false,
  maxFileSize: 10 * 1024 * 1024,
  maxFields: 1,
};

AWS.config.getCredentials(function (err) {
  if (err) console.log(err.stack);
  // credentials not loaded
  else {
    console.log("Access key:", AWS.config.credentials.accessKeyId);
  }
});

AWS.config.update({ region: "us-east-2" });

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
  const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
  const formParser = new IncomingForm(fileOptions);
  let [fields, files] = [];
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      formParser.parse(req, (err, fields, files) => {
        if (err) {
          console.log(err);
          reject(err);
        }

        resolve([fields, files]);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "file upload failed" });
    return;
  }

  const file = files["file"];

  if (!file) {
    res.status(400).json({ message: "No file found" });
    return;
  }

  const fileStream = fs.createReadStream(file.path);
  fileStream.on("error", function (err) {
    console.error(err);
    res.status(500).json({ message: "File stream error" });
  });

  const uploadedFileNameSplits = file.name.split(".");
  const fileExtension =
    uploadedFileNameSplits[uploadedFileNameSplits.length - 1];

  const fileNameToStore = `${nanoid()}.${fileExtension}`;

  const uploadParams = {
    Bucket: TEMP_FILE_STORE_BUCKET,
    Body: fileStream,
    Key: fileNameToStore,
  };

  let fileKey;
  try {
    fileKey = await new Promise((resolve, reject) => {
      s3.upload(uploadParams, function (err, data) {
        if (err) {
          reject(err);
        }
        resolve(data.Key);
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: "Something went wrong!" });
  }

  res.send({ fileKey, url: TEMP_WEB_BASE_URL + fileKey });
};

// first we need to disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};
