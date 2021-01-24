import { UserError, ServerError } from "../base/errors";
import { IncomingForm } from "formidable";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";

import AWS from "./aws";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const COLLAB_REQ_STORE_BUCKET = "collabice-request-store";

const COLLAB_FILES_BASE_URL =
  "https://collabice-request-store.s3.us-east-2.amazonaws.com/";

const fileOptions = {
  multiple: false, //one file per request
  maxFileSize: 10 * 1024 * 1024, //10 mb
  maxFields: 2, //one file + id
};

const TEN_MB = 10 * 1024 * 1024;

export const createSignedUploadUrl = async (
  req,
  validExtensions,
  maxSize = TEN_MB
) => {
  const { body: uploadFileRequest } = req;

  let { collabId, fileName } = uploadFileRequest;

  if (!collabId) {
    throw new UserError("No collabId found in the request");
  }

  if (!fileName) {
    throw new UserError("No filename found");
  }

  fileName = fileName.trim();

  const fileNameParts = fileName.split(".");

  if (fileNameParts.length <= 1) {
    throw new UserError("Invalid filename");
  }

  const extension = fileNameParts[fileNameParts.length - 1].toLowerCase();

  if (!validExtensions.includes(extension)) {
    throw new UserError(
      `Invalid file extension ${extension}. Valid extensions are ${validExtensions.join(
        ","
      )}`
    );
  }

  const fileNameToStore = `${collabId}/${nanoid()}.${extension}`;

  const params = {
    Bucket: COLLAB_REQ_STORE_BUCKET,
    Fields: {
      key: fileNameToStore,
    },
    Expires: 60 * 10, // 10 min
    Conditions: [
      {
        bucket: COLLAB_REQ_STORE_BUCKET,
      },
      {
        key: fileNameToStore, // our generated key
      },
      ["content-length-range", 10, maxSize], // from 10 bytes to 1 MB
    ],
  };

  const signedPostReq = await new Promise((resolve, reject) => {
    s3.createPresignedPost(params, function (err, data) {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
  });

  return signedPostReq;
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
  const collabId = fields["collabId"];

  if (!collabId) {
    throw new UserError("No collabId found in the request");
  }

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

  const fileNameToStore = `${collabId}/${nanoid()}.${fileExtension}`;

  const uploadParams = {
    Bucket: COLLAB_REQ_STORE_BUCKET,
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

  return { fileKey, url: COLLAB_FILES_BASE_URL + fileKey };
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
