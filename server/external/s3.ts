import { nanoid } from "nanoid";

import AWS from "server/external/aws";
// eslint-disable-next-line import/no-unresolved
import { Stream } from "node:stream";
import { UserError } from "server/base/errors";
import logger from "server/base/Logger";
import { ObjectList } from "aws-sdk/clients/s3";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const s3ClientWithAcceleration = new AWS.S3({
  apiVersion: "2006-03-01",
  useAccelerateEndpoint: true,
});

const FIFTEEN_MB = 15 * 1024 * 1024;

export function createDestinationFileKey(
  fileName: string,
  validExtensions: string[],
  keyPrefix = ""
) {
  const fileNameParts = fileName.split(".");

  if (fileNameParts.length <= 1) {
    // If there is no file extension, still go ahead and give it a random name without extension
    // Other parts of the system will read the file and handle it
    return `${keyPrefix}${nanoid()}`;
  }

  const extension = fileNameParts[fileNameParts.length - 1].toLowerCase();

  if (!validExtensions.includes(extension)) {
    throw new UserError(
      `Invalid file extension ${extension}. Valid extensions are ${validExtensions.join(
        ","
      )}`
    );
  }

  return `${keyPrefix}${nanoid()}.${extension}`;
}

export enum GetSignedUrlOperation {
  postObject = "postObject",
  putObject = "putObject",
}

export const createSignedUploadUrl = async (
  fileName: string,
  bucketName: string,
  validExtensions: string[],
  {
    keyPrefix = "",
    outFileKey = null,
    maxSize = FIFTEEN_MB,
    operation = GetSignedUrlOperation.postObject,
  }: {
    keyPrefix?: string;
    outFileKey?: string;
    maxSize?: number;
    operation?: GetSignedUrlOperation;
  }
) => {
  if (!fileName) {
    throw new UserError("No filename found");
  }

  const fileNameToStore =
    outFileKey ??
    createDestinationFileKey(fileName.trim(), validExtensions, keyPrefix);

  const expireIn = 60 * 10; // 10 min

  return await new Promise((resolve, reject) => {
    if (operation === GetSignedUrlOperation.postObject) {
      const params = {
        Bucket: bucketName,
        Fields: {
          key: fileNameToStore,
        },
        Expires: expireIn,
        Conditions: [
          {
            bucket: bucketName,
          },
          {
            key: fileNameToStore,
          },
          ["content-length-range", 10, maxSize], // from 10 bytes to 1 MB
        ],
      };
      s3.createPresignedPost(params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    } else {
      const params = {
        Bucket: bucketName,
        Key: fileNameToStore,
        Expires: expireIn,
      };
      s3ClientWithAcceleration.getSignedUrl(operation, params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    }
  });
};

export const doesObjectExist = async (bucketName: string, fileKey: string) =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.headObject(params, (err, data) => {
      if (err) {
        if ([404, 403].includes(err.statusCode)) {
          // At times s3 incorrectly returns 403 instead of 404. Assume as 404.
          return resolve(false);
        }
        logger.error({
          op: err.code,
          message: err.message,
        });
        return reject(err);
      }
      if (data) {
        return resolve(true);
      }
      return resolve(false);
    });
  });

export const getObject = async (
  bucketName: string,
  fileKey: string
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.getObject(params, (err, data) => {
      if (err) {
        if (["NoSuchKey", "Forbidden"].includes(err.code)) {
          // At times s3 incorrectly returns "Forbidden" instead of "NoSuchKey".
          // Assume as "NoSuchKey".
          return reject(
            new UserError("Can't find an image with specified key!")
          );
        }
        logger.error({
          op: err.code,
          message: err.message,
        });
        return reject(err);
      }
      return resolve(data.Body as Buffer);
    });
  });

export const uploadObject = async (
  bucketName: string,
  fileKey: string,
  readableObject: Stream | Buffer
) =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: readableObject,
    };
    s3.upload(params, (err: Error, data: AWS.S3.ManagedUpload.SendData) => {
      if (err) {
        logger.error({
          op: err.toString(),
          message: err.message,
        });
        return reject(err);
      }
      return resolve(data);
    });
  });

export const copyObject = async (
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
) =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: destBucket,
      CopySource: `/${sourceBucket}/${sourceKey}`,
      Key: destKey,
    };
    s3.copyObject(params, (err, data) => {
      if (err) {
        logger.error({
          op: err.code,
          message: err.message,
        });
        return reject(err);
      }
      return resolve(data);
    });
  });

export const deleteObject = async (
  bucketName: string,
  fileKey: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
    };
    s3.deleteObject(params, (err) => {
      if (err) {
        if (["NoSuchKey", "Forbidden"].includes(err.code)) {
          // Assume this to be part of a retry of a bulk delete operation where this object
          // was already deleted.
          // Also, at times s3 incorrectly returns "Forbidden" instead of "NoSuchKey".
          // Assume as "NoSuchKey".
          return resolve();
        }
        logger.error({
          op: err.code,
          message: err.message,
        });
        return reject(err);
      }
      return resolve();
    });
  });

export const listObjectsInFolder = async (
  bucketName: string,
  folderPrefix: string
): Promise<ObjectList> =>
  (
    await s3
      .listObjectsV2({
        Bucket: bucketName,
        Prefix: folderPrefix,
        // Delimiter: "/",
      })
      .promise()
  )?.Contents || [];
