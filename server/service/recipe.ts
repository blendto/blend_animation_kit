import "reflect-metadata";
import { inject, injectable } from "inversify";

import { IService } from "server/service";
import DynamoDB from "server/external/dynamodb";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { Recipe } from "server/base/models/recipe";
import { UserError } from "server/base/errors";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { createSignedUploadUrl } from "server/external/s3";
import { PresignedPost } from "aws-sdk/lib/s3/presigned_post";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

@injectable()
export class RecipeService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async getRecipe(id: string, variant = "9:16"): Promise<Recipe> {
    const recipe = await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    });
    return <Recipe>recipe;
  }

  async saveRecipeThumbnail(id: string, variant = "9:16"): Promise<void> {
    const recipe = (await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    })) as Recipe;

    if (!recipe) {
      throw new UserError("Invalid recipe", "404");
    }

    const { fileName, fileKey } = RecipeService.thumbnailFileKey(recipe);
    const uploadDetails = (await createSignedUploadUrl(
      fileName,
      ConfigProvider.RECIPE_INGREDIENTS_BUCKET,
      VALID_UPLOAD_IMAGE_EXTENSIONS,
      {
        outFileKey: fileKey,
        maxSize: MAX_FILE_SIZE,
      }
    )) as PresignedPost;

    await new VesApi().savePreview({
      body: recipe,
      schema: ExportRequestSchema.Recipe,
      uploadDetails,
    });

    await this.dataStore.updateItem({
      UpdateExpression: "SET #thumbnail = :thumbnail",
      ExpressionAttributeNames: {
        "#thumbnail": "thumbnail",
      },
      ExpressionAttributeValues: {
        ":thumbnail": fileKey,
      },
      Key: { id, variant },
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }

  private static thumbnailFileKey(recipe: Recipe) {
    const isStatic: boolean =
      recipe.gifsOrStickers === null || recipe.gifsOrStickers.length === 0;
    const fileName = isStatic ? `${Date.now()}.jpeg` : `${Date.now()}.webp`;
    const subFolder = recipe.variant.replaceAll(":", "-");

    const fileKey = `${recipe.id}/${subFolder}/thumbnail/${fileName}`;
    return { fileName, fileKey };
  }
}
