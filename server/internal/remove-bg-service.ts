import "reflect-metadata";
import FormData from "form-data";
import axios, { AxiosInstance, AxiosResponse } from "axios";
import { IncomingMessage } from "http";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";
import { IService } from "server/service";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import type DynamoDB from "server/external/dynamodb";
import { DateTime } from "luxon";
import { HeroImageFileKeys } from "server/base/models/heroImage";
import { getObject, uploadObject } from "server/external/s3";
import { bufferToStream, streamToBuffer } from "server/helpers/bufferUtils";
import logger from "server/base/Logger";
import sharp from "sharp";
import axiosRetry from "axios-retry";
import { Stream } from "stream";

export interface ToolkitErrorResponse {
  code?: string;
  message: string;
}

export interface ImageFileKeys {
  original: string;
  withoutBg: string;
}

export enum RemoveBGSource {
  BLEND = "BLEND",
}

interface RemoveBGCommandMetadata {
  source: RemoveBGSource;
  fileKeys: ImageFileKeys;
}
@injectable()
export class RemoveBgService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: ConfigProvider.BG_REMOVER_BASE_PATH,
      headers: { "X-API-KEY": ConfigProvider.BG_REMOVER_API_KEY },
    });
    axiosRetry(this.httpClient, { retries: 3 });
  }

  static constructBgRemovedFileKey = (fileKey: string) => {
    const fileKeyParts = fileKey.split("/");

    const [fileNameWithExt] = fileKeyParts.slice(-1);

    const fileNameWithoutExt = fileNameWithExt.includes(".")
      ? fileNameWithExt.split(".").slice(0, -1).join(".")
      : fileNameWithExt;

    const bgRemovedFileName = `${fileNameWithoutExt}-bg-removed.png`;

    const bgMaskFileName = `${fileNameWithoutExt}-bg-mask.png`;

    const bgRemovedFileKey = [
      ...fileKeyParts.slice(0, -1),
      "/",
      bgRemovedFileName,
    ].join("");

    const bgMaskFileKey = [
      ...fileKeyParts.slice(0, -1),
      "/",
      bgMaskFileName,
    ].join("");

    return { bgRemovedFileKey, bgMaskFileKey, fileNameWithExt };
  };

  logBgRemoval = async (
    predictedClass: string,
    segmentationProvider: string,
    metadata: RemoveBGCommandMetadata
  ) => {
    const currentTime = DateTime.utc();
    const currentDate = currentTime.toISODate();

    const entry = {
      createdOn: currentDate,
      createdAt: currentTime.toMillis(),
      detectedItem: predictedClass,
      providerUsed: segmentationProvider,
      source: metadata.source,
      fileKeys: metadata.fileKeys,
    };

    await this.dataStore.putItem({
      TableName: ConfigProvider.BG_REMOVAL_LOG_TABLE_NAME,
      Item: entry,
    });
  };

  private handleBgRemovalException = async (
    fn: () => Promise<void>,
    metadata: RemoveBGCommandMetadata
  ) => {
    try {
      await fn.call(this);
    } catch (ex) {
      if (axios.isAxiosError(ex)) {
        logger.error({
          code: "RemoveBgService.RemoveBGFailed",
          key: metadata.fileKeys.original,
          message: ex.message,
        });
        let data = "";
        // eslint-disable-next-line no-restricted-syntax
        for await (const chunk of ex.response.data) {
          data += chunk;
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const error: ToolkitErrorResponse = JSON.parse(data);

        let errorMessage = error.message;

        if (error.code === "unknown_foreground") {
          errorMessage = "Unable to remove background";
        }

        throw new UserError(errorMessage, error.code);
      }
      throw ex;
    }
  };

  removeBg = async (
    fileBuffer: Buffer,
    fileName: string,
    crop: boolean,
    onlyMask: boolean,
    metadata: RemoveBGCommandMetadata
  ): Promise<Buffer> => {
    const config = {
      crop: "False",
      channel: "rgba",
    };
    // we need capital T for True in crop
    if (crop) config.crop = "True";
    if (onlyMask) {
      config.channel = "alpha";
    }
    const form = new FormData();
    form.append("file", fileBuffer, fileName);
    Object.keys(config).forEach((key) => {
      form.append(key, config[key]);
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    let response: AxiosResponse<IncomingMessage>;
    await this.handleBgRemovalException(async () => {
      response = await this.httpClient.post("/removeBg", form, {
        headers: form.getHeaders(),
        responseType: "stream",
        // Infinite maxContentLength and maxBodyLength fixes
        // "Request body larger than maxBodyLength limit" issue
        // ref: https://stackoverflow.com/questions/56868023/error-request-body-larger-than-maxbodylength-limit-when-sending-base64-post-req
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    }, metadata);

    const { data, headers } = response as {
      data: Stream;
      headers: Record<string, string>;
    };
    await this.logBgRemoval(
      headers["x-predicted-class"],
      headers["x-segmentation-provider"],
      metadata
    );

    const buffer = await streamToBuffer(data);

    await RemoveBgService.validateImage(buffer);

    return buffer;
  };

  static validateImage = async (buffer: Buffer) => {
    await sharp(buffer, {}).metadata();
  };

  async removeBgAndStore(
    fileKeys: HeroImageFileKeys
  ): Promise<{ fileKeys: HeroImageFileKeys; updated: boolean }> {
    if (fileKeys.withoutBg) {
      return {
        fileKeys,
        updated: false,
      };
    }

    const fileKey = fileKeys.original;
    const { bgRemovedFileKey, fileNameWithExt } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);

    const originalImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKey
    );

    const webp = await sharp(originalImage, {
      failOnError: false,
    })
      .toFormat("webp", { quality: 90 })
      .toBuffer();

    let imageToUse = webp;

    const compressedImageMetadata = await sharp(webp).metadata();
    if (compressedImageMetadata.size > 1024 * 1024 * 10) {
      logger.info({
        op: "COMPRESSED_IMAGE_TOO_LARGE",
        message: "Compressed webp is larger than input image.",
      });
      imageToUse = originalImage;
    }
    const bgRemoved = await this.removeBg(
      imageToUse,
      fileNameWithExt,
      true,
      false,
      {
        source: RemoveBGSource.BLEND,
        fileKeys: {
          original: fileKey,
          withoutBg: bgRemovedFileKey,
        },
      }
    );

    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey,
      bufferToStream(bgRemoved)
    );

    return {
      fileKeys: {
        original: fileKey,
        withoutBg: bgRemovedFileKey,
      },
      updated: true,
    };
  }
}
