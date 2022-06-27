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
import VesApi, {
  ExportRequestSchema,
  SaveExportRequest,
} from "server/internal/ves";
import { Recipe, RecipeWrapper } from "server/base/models/recipe";
import { Blend } from "server/base/models/blend";
import { Batch, BatchWrapper } from "server/base/models/batch";
import { diContainer } from "inversify.config";
import logger from "server/base/Logger";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";

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
      ...this.exportRequest(),
      uploadDetails,
    });

    await this.deletePreviews({ skipFileKey: previewFileKey });

    await batchService.updatePreview(
      this.batch.id,
      this.blend.id,
      previewFileKey
    );
  }

  async saveExport() {
    const output = await this.vesApi.saveExport(this.exportRequest());
    const batchService = diContainer.get<BatchService>(TYPES.BatchService);
    await batchService.updateExport(this.batch.id, this.blend.id, output);
  }

  private async deletePreviews({ skipFileKey }) {
    try {
      const objects = await listObjectsInFolder(
        ConfigProvider.BLEND_OUTPUT_BUCKET,
        this.blend.id
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

  private static async presignedPost(fileName: string, previewFileKey: string) {
    return (await createSignedUploadUrl(
      fileName,
      ConfigProvider.BLEND_OUTPUT_BUCKET,
      VALID_UPLOAD_IMAGE_EXTENSIONS,
      {
        outFileKey: previewFileKey,
        maxSize: MAX_FILE_SIZE,
      }
    )) as PresignedPost;
  }

  private previewFileKey(recipe: Recipe) {
    const isStatic: boolean =
      recipe.gifsOrStickers === null || recipe.gifsOrStickers.length === 0;
    const fileName = isStatic ? `${Date.now()}.jpeg` : `${Date.now()}.webp`;
    const previewFileKey = `${this.blend.id}/preview/${fileName}`;
    return { fileName, previewFileKey };
  }

  private exportRequest(): SaveExportRequest {
    // TODO:  Remove this hack.
    //        This is needed because VES uses the id to decided which
    //        output folder to write to.
    //        Ideally, we should send a separate folder prefix.
    const wrapper = new RecipeWrapper(this.recipe);
    wrapper.replaceId(this.blend.id);

    return new BatchWrapper(this.batch).isBlendModified(this.blend.id)
      ? { body: this.blend, schema: ExportRequestSchema.Blend }
      : { body: this.recipe, schema: ExportRequestSchema.Recipe };
  }
}
