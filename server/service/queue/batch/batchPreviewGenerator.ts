import "reflect-metadata";
import { TYPES } from "server/types";
import { BatchService } from "server/service/batch";
import ConfigProvider from "server/base/ConfigProvider";
import {
  createSignedUploadUrl,
  deleteObject,
  listObjectsInFolder,
} from "server/external/s3";
import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import VesApi, { PreviewRequestSchema } from "server/internal/ves";
import { Recipe } from "server/base/models/recipe";
import { Blend } from "server/base/models/blend";
import { Batch, BatchWrapper } from "server/base/models/batch";
import { diContainer } from "inversify.config";
import logger from "server/base/Logger";

const VALID_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export class BatchPreviewGenerator {
  vesApi = new VesApi();
  blend: Blend;
  batch: Batch;
  recipe: Recipe;

  constructor(blend: Blend, batch: Batch, recipe: Recipe) {
    this.blend = blend;
    this.batch = batch;
    this.recipe = recipe;
  }

  async savePreview() {
    const batchService = diContainer.get<BatchService>(TYPES.BatchService);

    const { fileName, previewFileKey } = this.previewFileKey(this.recipe);
    const uploadDetails = await BatchPreviewGenerator.presignedPost(
      fileName,
      previewFileKey
    );

    await this.vesApi.savePreview({
      ...this.previewRequest(),
      uploadDetails,
    });

    await this.deletePreviews({ skipFileKey: previewFileKey });

    await batchService.updatePreview(
      this.batch.id,
      this.blend.id,
      previewFileKey
    );
  }

  private async deletePreviews({ skipFileKey }) {
    try {
      const objects = await listObjectsInFolder(
        ConfigProvider.BLEND_OUTPUT_BUCKET,
        this.blend.id
      );
      for (const object of objects) {
        if (object.Key === skipFileKey) {
          continue;
        }
        await deleteObject(ConfigProvider.BLEND_OUTPUT_BUCKET, object.Key);
      }
    } catch (err) {
      logger.error(err);
    }
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

  private previewFileKey(recipe: Recipe) {
    const isStatic: Boolean =
      recipe.gifsOrStickers === null || recipe.gifsOrStickers.length === 0;
    const fileName = isStatic ? `${Date.now()}.jpeg` : `${Date.now()}.webp`;
    const previewFileKey = `${this.blend.id}/preview/${fileName}`;
    return { fileName, previewFileKey };
  }

  private previewRequest(): {
    body: Recipe;
    schema: PreviewRequestSchema;
  } {
    return new BatchWrapper(this.batch).isBlendModified(this.blend.id)
      ? { body: this.blend, schema: PreviewRequestSchema.blend }
      : { body: this.recipe, schema: PreviewRequestSchema.recipe };
  }
}
