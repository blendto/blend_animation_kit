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
import { ImageFileKeys } from "server/base/models/heroImage";
import { getObject, uploadObject } from "server/external/s3";
import { bufferToStream, streamToBuffer } from "server/helpers/bufferUtils";
import logger from "server/base/Logger";
import axiosRetry from "axios-retry";
import { Stream } from "stream";
import { sharpInstance } from "server/helpers/sharpUtils";
import {
  applyMask,
  readImageMetadata,
  rescaleImage,
} from "server/helpers/imageUtils";
import { addSuffixToFileKey } from "server/helpers/fileKeyUtils";
import {
  BgRemovalMetadata,
  BgRemovalRetriggerCheckResponse,
  RemoveBGCommandMetadata,
  RemoveBGSource,
  ToolkitErrorResponse,
} from "server/base/models/removeBg";
import { handleAxiosCall } from "../helpers/network";
import { ValidImageExtension } from "../helpers/constants";
import { Rect } from "../helpers/rect";

export interface ConstructBgRemovedFileKeyOptions {
  superClass?: string;
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

  static constructBgRemovedFileKey = (
    fileKey: string,
    options?: ConstructBgRemovedFileKeyOptions
  ) => {
    const fileKeyParts = fileKey.split("/");

    const [fileNameWithExt] = fileKeyParts.slice(-1);

    const fileNameWithoutExt = fileNameWithExt.includes(".")
      ? fileNameWithExt.split(".").slice(0, -1).join(".")
      : fileNameWithExt;

    const categorySuffix = options?.superClass ? `-${options?.superClass}` : "";

    const bgRemovedFileName = `${fileNameWithoutExt}${categorySuffix}-bg-removed.png`;

    const bgMaskFileName = `${fileNameWithoutExt}${categorySuffix}-bg-mask.png`;

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

  static validateImage = async (
    buffer: Buffer,
    fileExtension?: ValidImageExtension
  ) => {
    await (await sharpInstance(buffer, {}, fileExtension)).metadata();
  };

  logBgRemoval = async (
    removalMetadata: BgRemovalMetadata,
    metadata: RemoveBGCommandMetadata
  ) => {
    const currentTime = DateTime.utc();
    const currentDate = currentTime.toISODate();

    const entry = {
      createdOn: currentDate,
      createdAt: currentTime.toMillis(),
      detectedItem: removalMetadata.predictedClass,
      detectedObjectClass: removalMetadata.primaryClass,
      providerUsed: removalMetadata.segmentationProvider,
      qualityConfidence: removalMetadata.qualityConfidence,
      source: metadata.source,
      fileKeys: metadata.fileKeys,
    };

    await this.dataStore.putItem({
      TableName: ConfigProvider.BG_REMOVAL_LOG_TABLE_NAME,
      Item: entry,
    });
  };

  shouldRetriggerBgRemoval = async (
    predictedClass: string,
    updatedClass: string
  ): Promise<BgRemovalRetriggerCheckResponse> => {
    const { data } = await handleAxiosCall<Record<string, unknown>>(
      async () =>
        await this.httpClient.post("/bgRemovalTriggerCheck", {
          predicted_super_class: predictedClass,
          updated_super_class: updatedClass,
        })
    );
    return {
      updatedSuperClass: data.updated_super_class as string,
      isRetriggerRequired: data.is_retrigger_required as boolean,
      predictedSuperClass: data.predicted_super_class as string,
    };
  };

  removeBg = async (
    fileBuffer: Buffer,
    fileName: string,
    crop: boolean,
    onlyMask: boolean,
    metadata: RemoveBGCommandMetadata,
    category?: string
  ): Promise<{ buffer: Buffer; metadata: BgRemovalMetadata }> => {
    const config = {
      crop: "False",
      channel: "rgba",
      category,
    };
    // we need capital T for True in crop
    if (crop) config.crop = "True";
    if (onlyMask) {
      config.channel = "alpha";
    }

    const form = new FormData();
    form.append("file", fileBuffer, fileName);
    Object.keys(config).forEach((key) => {
      if (!config[key]) return;
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

    const bgRemovalMetadata = {
      predictedClass: headers["x-predicted-class"],
      primaryClass: headers["x-primary-class"],
      segmentationProvider: headers["x-segmentation-provider"],
      qualityConfidence: headers["x-quality-confidence"],
      cropBoundaries: Rect.tryParseBase64LTRB(
        headers["x-crop-boundaries-ltrb"]
      ),
    };

    await this.logBgRemoval(bgRemovalMetadata, metadata);

    const buffer = await streamToBuffer(data);

    await RemoveBgService.validateImage(buffer);

    return { buffer, metadata: bgRemovalMetadata };
  };

  async removeBgAndStore(fileKeys: ImageFileKeys): Promise<{
    fileKeys: ImageFileKeys;
    updated: boolean;
    bgRemovalMetadata?: BgRemovalMetadata;
  }> {
    if (fileKeys.withoutBg) {
      return {
        fileKeys,
        updated: false,
      };
    }

    const fileKey = fileKeys.original;
    const { bgRemovedFileKey, fileNameWithExt, bgMaskFileKey } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);

    const originalImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      fileKey
    );

    const sharpInst = await sharpInstance(originalImage, {
      failOnError: false,
    });

    const { width, height } = await sharpInst.metadata();
    const webp = await sharpInst
      .toFormat("webp", { quality: 90 })
      .withMetadata()
      .toBuffer();

    let imageToUse = webp;

    const compressedImageMetadata = await (
      await sharpInstance(webp)
    ).metadata();
    if (compressedImageMetadata.size > 1024 * 1024 * 10) {
      logger.info({
        op: "COMPRESSED_IMAGE_TOO_LARGE",
        message: "Compressed webp is larger than input image.",
      });
      imageToUse = originalImage;
    }
    const bgMask = await this.removeBg(
      imageToUse,
      fileNameWithExt,
      true,
      true,
      {
        source: RemoveBGSource.BLEND,
        fileKeys: {
          original: fileKey,
          withoutBg: bgRemovedFileKey,
        },
      }
    );

    const rescaledMask = await rescaleImage(bgMask.buffer, { width, height });
    const bgRemovedImageUsingMask = await applyMask(
      originalImage,
      rescaledMask,
      bgMask.metadata.cropBoundaries
    );

    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedFileKey,
      bufferToStream(bgRemovedImageUsingMask.data)
    );

    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgMaskFileKey,
      bufferToStream(rescaledMask)
    );

    return {
      fileKeys: {
        original: fileKey,
        withoutBg: bgRemovedFileKey,
        mask: bgMaskFileKey,
      },
      bgRemovalMetadata: bgMask.metadata,
      updated: true,
    };
  }

  async applyMaskAndUpload(
    originalFileKey: string,
    maskFileKey: string
  ): Promise<string> {
    const originalImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      originalFileKey
    );
    const maskImage = await getObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      maskFileKey
    );

    const metadata = await readImageMetadata(originalImage);
    const { width, height } = metadata;
    const rescaledMask = await rescaleImage(maskImage, { width, height });

    const bgRemovedImageUsingMask = await applyMask(
      originalImage,
      rescaledMask
    );
    const bgRemovedImageFileKey = addSuffixToFileKey(
      maskFileKey,
      "-bg-removed"
    );
    await uploadObject(
      ConfigProvider.BLEND_INGREDIENTS_BUCKET,
      bgRemovedImageFileKey,
      bufferToStream(bgRemovedImageUsingMask.data)
    );
    return bgRemovedImageFileKey;
  }

  private handleBgRemovalException = async (
    fn: () => Promise<void>,
    metadata: RemoveBGCommandMetadata
  ) => {
    try {
      await fn.call(this);
    } catch (ex) {
      if (axios.isAxiosError(ex) && ex.response) {
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
}
