import { nanoid } from "nanoid";

import AWS from "server/external/aws";
// eslint-disable-next-line import/no-unresolved
import { Stream } from "node:stream";
import { UserError } from "server/base/errors";
import logger from "server/base/Logger";
import { ObjectList } from "aws-sdk/clients/s3";
import { AWSError } from "aws-sdk";

class S3 {
  private s3: AWS.S3;
  private s3WithAcceleration: AWS.S3;

  getS3 = async () => {
    if (!this.s3) {
      this.s3 = new AWS.S3({ apiVersion: "2006-03-01" });
      await this.s3.config.credentialProvider.resolvePromise();
      logger.info("AWS creds loaded");
    }
    return this.s3;
  };

  getS3WithAcceleration = async () => {
    if (!this.s3WithAcceleration) {
      this.s3WithAcceleration = new AWS.S3({
        apiVersion: "2006-03-01",
        useAccelerateEndpoint: true,
      });
      await this.s3WithAcceleration.config.credentialProvider.resolvePromise();
      logger.info("AWS creds loaded");
    }
    return this.s3WithAcceleration;
  };
}

const { getS3, getS3WithAcceleration } = new S3();

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
    logger.error({ op: "INVALID_FILE_EXTENSION", fileName });
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

  const s3 = await getS3();
  const s3WithAcceleration = await getS3WithAcceleration();
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
      s3WithAcceleration.getSignedUrl(operation, params, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    }
  });
};

export const doesObjectExist = async (
  bucketName: string,
  fileKey: string
): Promise<boolean> => {
  const s3 = await getS3();
  return new Promise((resolve, reject) => {
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
};

export const getObject = async (
  bucketName: string,
  fileKey: string
): Promise<Buffer> => {
  const s3 = await getS3();
  return new Promise((resolve, reject) => {
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
};

export const uploadObject = async (
  bucketName: string,
  fileKey: string,
  readableObject: Stream | Buffer
) => {
  const s3 = await getS3();
  return new Promise((resolve, reject) => {
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
};

export const copyObject = async (
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
) => {
  const s3 = await getS3();
  return new Promise((resolve, reject) => {
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
};

export const deleteObject = async (
  bucketName: string,
  fileKey: string
): Promise<void> => {
  const s3 = await getS3();
  return new Promise((resolve, reject) => {
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
};

export const deleteMultipleObjects = async (
  bucketName: string,
  fileKeys: string[]
): Promise<void> => {
  const s3 = await getS3();
  const params = {
    Bucket: bucketName,
    Delete: {
      Objects: fileKeys.map((f) => ({ Key: f })),
    },
  };
  return new Promise((resolve, reject) => {
    s3.deleteObjects(params, (err) => {
      if (err) {
        logger.error({
          op: err.code,
          message: err.message,
        });
        return reject(err);
      }
      return resolve();
    });
  });
};

export const listObjectsInFolder = async (
  bucketName: string,
  folderPrefix: string
): Promise<ObjectList> =>
  (
    await (
      await getS3()
    )
      .listObjectsV2({
        Bucket: bucketName,
        Prefix: folderPrefix,
        // Delimiter: "/",
      })
      .promise()
  )?.Contents || [];

export const listAndDeleteObjectsInFolder = async (
  bucketName: string,
  folderPrefix: string
) => {
  const objects = await listObjectsInFolder(bucketName, folderPrefix);
  if (objects.length) {
    await deleteMultipleObjects(
      bucketName,
      objects.map((o) => o.Key)
    );
  }
};

export const appendTagsToObject = async (
  bucketName: string,
  fileKey: string,
  tagSet: { Key: string; Value: string }[]
) => {
  const s3 = await getS3();
  try {
    const currentTagging = await s3
      .getObjectTagging({
        Bucket: bucketName,
        Key: fileKey,
      })
      .promise();
    for (const currentTag of currentTagging.TagSet) {
      if (!tagSet.find((newTag) => newTag.Key === currentTag.Key)) {
        tagSet.push(currentTag);
      }
    }
    await s3
      .putObjectTagging({
        Bucket: bucketName,
        Key: fileKey,
        Tagging: {
          TagSet: tagSet,
        },
      })
      .promise();
  } catch (e) {
    if ((e as AWSError).code === "NoSuchKey") {
      logger.warn({
        op: "RECIEVED_REQUEST_TO_UPDATE_TAGS_OF_NON_EXISTENT_S3_ASSET",
        fileKey,
      });
    } else {
      throw e;
    }
  }
};
