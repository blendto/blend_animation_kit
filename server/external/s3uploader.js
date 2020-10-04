import { UserError, ServerError } from "../base/errors";
import { IncomingForm } from "formidable";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";

var AWS = require("aws-sdk");

AWS.config.getCredentials(function (err) {
  if (err) console.log(err.stack);
  // credentials not loaded
  else {
    console.log("Access key:", AWS.config.credentials.accessKeyId);
  }
});

AWS.config.update({ region: "us-east-2" });

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const TEMP_FILE_STORE_BUCKET = "collabice-temp-file-store";
export const COLLAB_REQ_STORE_BUCKET = "collabice-request-store";

const TEMP_WEB_BASE_URL =
  "https://collabice-temp-file-store.s3.us-east-2.amazonaws.com/";

const fileOptions = {
  multiple: false, //one file per request
  maxFileSize: 10 * 1024 * 1024, //10 mb
  maxFields: 1, //one file per request
};

export const uploadTempUserContent = async (req) => {
  const formParser = new IncomingForm(fileOptions);
  let [fields, files] = [];
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      formParser.parse(req, (err, fields, files) => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }

        resolve([fields, files]);
      });
    });
  } catch (err) {
    console.error(err);
    throw new UserError("file upload failed");
  }

  const file = files["file"];

  if (!file) {
    throw new UserError("No file found");
  }

  const fileStream = fs.createReadStream(file.path);
  fileStream.on("error", function (err) {
    console.error(err);
    throw new ServerError("File stream error");
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
          return;
        }
        resolve(data.Key);
      });
    });
  } catch (err) {
    console.error(err);
    throw new ServerError("Something went wrong!");
  }

  return { fileKey, url: TEMP_WEB_BASE_URL + fileKey };
};

export const copyObject = (Bucket, CopySource, Key) => {
  const params = {
    Bucket,
    CopySource,
    Key,
  };
  return new Promise((resolve, reject) => {
    s3.copyObject(params, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });
};
