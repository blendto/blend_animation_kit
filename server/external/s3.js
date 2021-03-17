import { UserError, ServerError } from "../base/errors";
import { nanoid } from "nanoid";

import AWS from "./aws";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

export const COLLAB_REQ_STORE_BUCKET = "collabice-request-store";

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

export const doesObjectExist = async (bucketName, fileKey) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.headObject(params, (err, data) => {
      if (err) {
        // If object does not exist it gives:
        // 404 NoSuchKey if user has ListBucket permission
        // 403 AccessDenied if user does not have ListBucket permission
        console.log("amazon error code:" + err.code);
        if (err.code == "NoSuchKey" || err.code == "AccessDenied") {
          return resolve(false);
        }
        console.error(err);
        return reject(new ServerError("Something went wrong!"));
      }
      if (data) {
        return resolve(true);
      }
      return resolve(false);
    });
  });
};

export const getObject = async (bucketName, fileKey) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.getObject(params, (err, data) => {
      if (err) {
        // If object does not exist it gives:
        // 404 NoSuchKey if user has ListBucket permission
        // 403 AccessDenied if user does not have ListBucket permission
        console.log("amazon error code:" + err.code);
        if (err.code == "NoSuchKey" || err.code == "AccessDenied") {
          return reject(
            new UserError("Can't find an image with specified key!")
          );
        }
        console.error(err);
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data.Body);
    });
  });
};

export const uploadObject = async (bucketName, fileKey, stream) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: stream,
    };
    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err, err.stack);
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data);
    });
  });
};
