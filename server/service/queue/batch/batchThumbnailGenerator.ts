import { Batch } from "server/base/models/batch";
import {
  createSignedUploadUrl,
  deleteObject,
  listObjectsInFolder,
} from "server/external/s3";
import ConfigProvider from "server/base/ConfigProvider";
import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import { diContainer } from "inversify.config";
import { BatchService } from "server/service/batch";
import { TYPES } from "server/types";
import VesApi, { SaveThumbnailRequest } from "server/internal/ves";
import logger from "server/base/Logger";

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export class BatchThumbNailGenerator {
  vesApi = new VesApi();
  batch: Batch;

  constructor(batch: Batch) {
    this.batch = batch;
  }

  async saveThumbnail() {
    const service = diContainer.get<BatchService>(TYPES.BatchService);
    const thumbNailRequestInput = (url: string) => ({
      url: ConfigProvider.OUTPUT_BASE_PATH + url,
    });

    const batchItemPreviews = Object.values(this.batch.previews);
    const previewUrls = batchItemPreviews
      .filter((p) => !p.failed && !!p.preview)
      .map((p) => thumbNailRequestInput(p.preview));

    const { fileName, thumbnailFileKey } = this.createFileKey();
    const uploadDetails = await BatchThumbNailGenerator.presignedPost(
      fileName,
      thumbnailFileKey
    );

    const thumbnailRequest = {
      inputs: previewUrls,
      count: this.batch.blends.length.toString(),
      uploadDetails,
    } as SaveThumbnailRequest;

    await this.vesApi.generateBatchThumbnail(thumbnailRequest);

    await this.deleteThumbnails({ skipFileKey: thumbnailFileKey });
    await service.updateThumbnail(this.batch.id, thumbnailFileKey);
  }

  private static async presignedPost(fileName: string, previewFileKey: string) {
    return (await createSignedUploadUrl(
      fileName,
      ConfigProvider.BLEND_OUTPUT_BUCKET,
      VALID_EXTENSIONS,
      {
        outFileKey: previewFileKey,
        maxSize: MAX_FILE_SIZE,
      }
    )) as PresignedPost;
  }

  private createFileKey() {
    const fileName = `${Date.now()}.jpeg`;
    const previewFileKey = `batch/${this.batch.id}/thumbnail/${fileName}`;
    return { fileName, thumbnailFileKey: previewFileKey };
  }

  private async deleteThumbnails({ skipFileKey }) {
    try {
      const objects = await listObjectsInFolder(
        ConfigProvider.BLEND_OUTPUT_BUCKET,
        `batch/${this.batch.id}/thumbnail`
      );
      const promises = objects.map(async (object) => {
        if (object.Key === skipFileKey) {
          return;
        }
        await deleteObject(ConfigProvider.BLEND_OUTPUT_BUCKET, object.Key);
      });
      await Promise.all(promises);
    } catch (err) {
      logger.error(err);
    }
  }
}
