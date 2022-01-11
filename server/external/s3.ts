import { UserError, ServerError } from "../base/errors";
import { nanoid } from "nanoid";

import AWS from "./aws";
import { Stream } from "node:stream";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const FIFTEEN_MB = 15 * 1024 * 1024;

export const createSignedUploadUrl = async (
  fileName: string,
  bucketName: string,
  validExtensions: string[],
  { keyPrefix = "", maxSize = FIFTEEN_MB }
) => {
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

  const fileNameToStore = `${keyPrefix}${nanoid()}.${extension}`;

  const params = {
    Bucket: bucketName,
    Fields: {
      key: fileNameToStore,
    },
    Expires: 60 * 10, // 10 min
    Conditions: [
      {
        bucket: bucketName,
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

export const doesObjectExist = async (bucketName: string, fileKey: string) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.headObject(params, (err, data) => {
      if (err) {
        // If object does not exist it gives:
        // 404 NoSuchKey or NotFound if user has ListBucket permission
        // 403 AccessDenied/Forbidden if user does not have ListBucket permission
        if ([404, 403].includes(err.statusCode)) {
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

export const getObject = async (
  bucketName: string,
  fileKey: string
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.getObject(params, (err, data) => {
      if (err) {
        // If object does not exist it gives:
        // 404 NoSuchKey if user has ListBucket permission
        // 403 Forbidden if user does not have ListBucket permission
        if (err.code == "NoSuchKey" || err.code == "Forbidden") {
          return reject(
            new UserError("Can't find an image with specified key!")
          );
        }
        console.error(err);
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data.Body as Buffer);
    });
  });
};

export const uploadObject = async (
  bucketName: string,
  fileKey: string,
  stream: Stream
) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: stream,
    };
    s3.upload(params, (err: Error, data: AWS.S3.ManagedUpload.SendData) => {
      if (err) {
        console.error(err, err.stack);
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data);
    });
  });
};

export const copyObject = async (
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: destBucket,
      CopySource: `/${sourceBucket}/${sourceKey}`,
      Key: destKey,
    };
    s3.copyObject(params, (err, data) => {
      if (err) {
        console.error(err, err.stack);
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data);
    });
  });
};
