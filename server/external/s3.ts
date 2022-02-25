import { nanoid } from "nanoid";

// eslint-disable-next-line import/no-unresolved
import { Stream } from "node:stream";
import { ServerError, UserError } from "server/base/errors";
import AWS from "./aws";

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const FIFTEEN_MB = 15 * 1024 * 1024;

export function createDestinationFileKey(
  fileName: string,
  validExtensions: string[],
  keyPrefix = ""
) {
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

  return `${keyPrefix}${nanoid()}.${extension}`;
}

export const createSignedUploadUrl = async (
  fileName: string,
  bucketName: string,
  validExtensions: string[],
  { keyPrefix = "", outFileKey = null, maxSize = FIFTEEN_MB }
) => {
  if (!fileName) {
    throw new UserError("No filename found");
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const fileNameToStore =
    outFileKey ??
    createDestinationFileKey(fileName.trim(), validExtensions, keyPrefix);

  const params = {
    Bucket: bucketName,
    Fields: {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      key: fileNameToStore,
    },
    Expires: 60 * 10, // 10 min
    Conditions: [
      {
        bucket: bucketName,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        key: fileNameToStore, // our generated key
      },
      ["content-length-range", 10, maxSize], // from 10 bytes to 1 MB
    ],
  };

  return new Promise((resolve, reject) => {
    s3.createPresignedPost(params, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data);
    });
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
        console.error({
          op: err.code,
          message: err.message,
        });
        return reject(new ServerError("Something went wrong!"));
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
        console.error({
          op: err.code,
          message: err.message,
        });
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data.Body as Buffer);
    });
  });

export const uploadObject = async (
  bucketName: string,
  fileKey: string,
  stream: Stream
) =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      Body: stream,
    };
    s3.upload(params, (err: Error, data: AWS.S3.ManagedUpload.SendData) => {
      if (err) {
        console.error({
          op: err.toString(),
          message: err.message,
        });
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve(data);
    });
  });

export const copyObject = async (
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
): Promise<AWS.S3.CopyObjectOutput> =>
  new Promise((resolve, reject) => {
    const params = {
      Bucket: destBucket,
      CopySource: `/${sourceBucket}/${sourceKey}`,
      Key: destKey,
    };
    s3.copyObject(params, (err, data) => {
      if (err) {
        console.error({
          op: err.code,
          message: err.message,
        });
        return reject(new ServerError("Something went wrong!"));
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    s3.deleteObject(params, (err, data) => {
      if (err) {
        if (["NoSuchKey", "Forbidden"].includes(err.code)) {
          // Assume this to be part of a retry of a bulk delete operation where this object
          // was already deleted.
          // Also, at times s3 incorrectly returns "Forbidden" instead of "NoSuchKey".
          // Assume as "NoSuchKey".
          return resolve();
        }
        console.error({
          op: err.code,
          message: err.message,
        });
        return reject(new ServerError("Something went wrong!"));
      }
      return resolve();
    });
  });
