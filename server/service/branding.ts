import "reflect-metadata";
import { PresignedPost } from "aws-sdk/clients/s3";
import { DateTime } from "luxon";
import { inject, injectable } from "inversify";
import { UserError } from "server/base/errors";
import ConfigProvider from "server/base/ConfigProvider";
import {
  copyObject,
  createDestinationFileKey,
  createSignedUploadUrl,
  deleteObject,
  getObject,
  GetSignedUrlOperation,
  uploadObject,
} from "server/external/s3";
import logger from "server/base/Logger";
import { IService } from "server/service";
import { UpdateOperations } from "server/repositories";
import {
  BrandingEntity,
  BrandingLogoStatus,
  MAX_LOGOS,
  BrandingUpdatePaths,
} from "server/repositories/branding";
import { convertImageToWebp, rescaleImage } from "server/helpers/imageUtils";
import { TYPES } from "server/types";
import { Repo } from "server/repositories/base";
import { BlendVersion } from "server/base/models/blend";
import { BlendToRecipeConverter } from "server/engine/blend/recipeConverter";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { ElementSource, Size } from "server/base/models/recipe";
import { RecipeList, RecipeSource } from "server/base/models/recipeList";
import { fireAndForget } from "server/helpers/async-runner";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";
import DynamoDB from "server/external/dynamodb";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { BlendService } from "./blend";
import { MAX_FILE_SIZE, RecipeService } from "./recipe";
import { UserService } from "./user";

const MAX_RECIPES_TO_RETURN = 20;

@injectable()
export default class BrandingService implements IService {
  validExtensions = ["png", "jpg", "jpeg", "webp"];
  @inject(TYPES.BrandingRepo) repo: Repo<BrandingEntity>;
  @inject(TYPES.BrandingRecipeRepo) brandingRecipeRepo: Repo<BrandingRecipe>;
  @inject(TYPES.UserService) userService: UserService;
  @inject(TYPES.BlendService) blendService: BlendService;
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  // Required as class attributes for mocking
  createDestinationFileKey = createDestinationFileKey;
  createSignedUploadUrl = createSignedUploadUrl;
  deleteObject = deleteObject;
  uploadObject = uploadObject;
  getObject = getObject;

  async get(userId: string): Promise<BrandingEntity> {
    return (await this.repo.query({ userId }))[0];
  }

  async getOrCreate(userId: string): Promise<BrandingEntity> {
    let existingProfile = await this.get(userId);
    if (!existingProfile) {
      existingProfile = await this.repo.create({ userId });
    }
    return existingProfile;
  }

  async update(
    userId: string,
    changes: {
      path: BrandingUpdatePaths;
      op: UpdateOperations;
      value?: unknown;
    }[]
  ): Promise<BrandingEntity> {
    const currentData = await this.get(userId);

    changes.forEach((change) => {
      if (change.path === BrandingUpdatePaths.primaryLogo) {
        if (
          [UpdateOperations.add, UpdateOperations.replace].includes(change.op)
        ) {
          const validLogoKeys = currentData.logos?.entries
            ?.filter((entry) => entry.status === BrandingLogoStatus.UPLOADED)
            .map((entry) => entry.fileKey);
          if (!validLogoKeys.includes(change.value as string)) {
            throw new UserError(
              "Primary logo is pointing to an invalid file key"
            );
          }
        } else {
          throw new UserError("Primary logo pointer can't be unset");
        }
      }
    });

    return await this.repo.update({ id: currentData.id }, changes, currentData);
  }

  async initLogoUpload(
    userId: string,
    fileName: string,
    size: Size
  ): Promise<{ url: string }> {
    const currentData = await this.get(userId);
    const uploadedLogos =
      currentData.logos?.entries?.filter(
        (entry) => entry.status === BrandingLogoStatus.UPLOADED
      ) || [];
    if (uploadedLogos.length >= MAX_LOGOS) {
      throw new UserError("You can't have more than 3 logos");
    }

    const fileKey = this.createDestinationFileKey(
      fileName,
      this.validExtensions,
      `${currentData.id}/`
    );

    const uploadURL = (await this.createSignedUploadUrl(
      fileName,
      ConfigProvider.BRANDING_BUCKET,
      this.validExtensions,
      { outFileKey: fileKey, operation: GetSignedUrlOperation.putObject }
    )) as string;

    await this.repo.update(
      { id: currentData.id },
      [
        {
          path: "/logos",
          op: "replace",
          value: {
            entries: [
              // If there are initialized logos, their upload probably failed in between.
              // Assume so and delete them from the profile.
              ...uploadedLogos,
              {
                status: BrandingLogoStatus.INITIALIZED,
                fileKey,
                size,
              },
            ],
            // If no uploaded logos exist, mark this as primary
            primaryEntry:
              uploadedLogos.length === 0
                ? fileKey
                : currentData.logos.primaryEntry,
          },
        },
      ],
      currentData
    );
    return { url: uploadURL };
  }

  async addRecipe(
    userId: string,
    sourceBlendId: string,
    heroAssetUid?: string,
    backgroundAssetUid?: string
  ) {
    const branding = await this.getOrCreate(userId);

    const blend = await this.blendService.getBlend(
      sourceBlendId,
      BlendVersion.generated,
      true
    );
    if (userId !== blend.createdBy) {
      logger.error(
        `A user is trying to access another user's blend. Blend id: ${blend.id}. ` +
          `Owner id: ${blend.createdBy}. Requesting user id: ${userId}`
      );
      // Don't let the possible attacker know that this is a valid blend id.
      throw new UserError("Invalid sourceBlendId");
    }

    const blendToRecipeConverter = new BlendToRecipeConverter(blend);
    const brandingRecipe = blendToRecipeConverter.convert(
      heroAssetUid,
      backgroundAssetUid
    ) as BrandingRecipe;
    brandingRecipe.userId = userId;
    brandingRecipe.brandingId = branding.id;

    const imageDestinationURIs = BlendToRecipeConverter.imageDestinationURIs(
      brandingRecipe,
      ElementSource.branding,
      branding.id
    );
    await Promise.all(
      brandingRecipe.images.map((i) =>
        copyObject(
          ConfigProvider.BLEND_INGREDIENTS_BUCKET,
          i.uri,
          ConfigProvider.BRANDING_BUCKET,
          imageDestinationURIs[i.uid]
        )
      )
    );
    brandingRecipe.images = brandingRecipe.images.map((i) => ({
      ...i,
      uri: imageDestinationURIs[i.uid],
      source: ElementSource.branding,
    }));
    brandingRecipe.thumbnail = await this.generateRecipeThumbnail(
      brandingRecipe
    );

    brandingRecipe.createdOn = brandingRecipe.updatedOn =
      DateTime.utc().toISODate();
    return await this.brandingRecipeRepo.createWithoutSurrogateKey(
      brandingRecipe
    );
  }

  async addToRecipeLists(userId: string, recipeLists: RecipeList[]) {
    const recipes = await this.getRecipes(userId);
    if (recipes.length > 0) {
      recipeLists.unshift({
        id: "branding",
        isEnabled: true,
        title: "💼 Your Brand Templates",
        recipeIds: [],
        recipes: recipes.map((r) => {
          const { title, thumbnail } = r;
          return {
            id: r.id,
            variant: r.variant,
            extra: {
              title,
              thumbnail,
              isPremium: true,
            },
            source: RecipeSource.BRANDING,
          };
        }),
        sortOrder: -1,
      });
    }
    return recipeLists;
  }

  async getRecipes(userId: string) {
    return this.brandingRecipeRepo.query(
      { userId },
      { limit: MAX_RECIPES_TO_RETURN, sort: "descending" }
    );
  }

  async useRecipe(userId: string, id: string, variant: string) {
    const recipe = await this.getRecipeOrFail(id, variant);
    if (userId !== recipe.createdBy) {
      logger.error(
        `A user is trying to access another user's branding recipe. Recipe id: ${recipe.id}. ` +
          `Owner id: ${recipe.createdBy}. Requesting user id: ${userId}`
      );
      // Don't let the possible attacker know that this is a valid recipe id.
      throw new UserError("Invalid recipe id");
    }
    fireAndForget(
      () =>
        // Can't use dynamoose as it auto-adds lastUsedAt since it's one of the updatedAt-timestamps
        // creating a double entry resulting in a "two document paths overlap" error
        this.dataStore.updateItem({
          TableName: ConfigProvider.BRANDING_RECIPE_DYNAMODB_TABLE,
          Key: { id, variant },
          UpdateExpression: `SET lastUsedAt = :lastUsedAt`,
          ExpressionAttributeValues: {
            ":lastUsedAt": Date.now(),
          },
          ReturnValues: "NONE",
        }),
      {
        operationName: "SAVING_BRANDING_RECIPE_USED_AT_TS",
      }
    ).catch(() => {});
    return recipe;
  }

  async deleteRecipe(userId: string, id: string, variant: string) {
    const recipe = await this.getRecipeOrFail(id, variant);
    if (recipe.userId !== userId) {
      logger.error({
        op: "UNAUTH_BRANDING_RECIPE_ACCESS",
        message: `A user is trying to delete another user's branding recipe!. Requesting user id: ${userId}. Recipe owner id: ${recipe.userId}`,
      });
      // Don't differentiate response so as to avoid enumeration attacks.
      throw new UserError("Invalid id/variant");
    }
    await this.brandingRecipeRepo.delete({ id, variant });
    const user = await this.userService.getOrFail(userId);
    const favouriteRecipesMinusDeleted = user.favouriteRecipes.filter(
      (r) => r.recipeId !== id
    );
    if (favouriteRecipesMinusDeleted.length !== user.favouriteRecipes.length) {
      await this.userService.updateFavouriteRecipes(
        userId,
        favouriteRecipesMinusDeleted
      );
    }
  }

  async getRecipeOrFail(id: string, variant: string) {
    const recipe = await this.brandingRecipeRepo.get({
      id,
      variant,
    });
    if (!recipe) {
      throw new UserError("Invalid branding recipe id/variant");
    }
    return recipe;
  }

  async generateRecipeThumbnail(recipe: BrandingRecipe): Promise<string> {
    const { fileName, fileKey } =
      BrandingService.recipeThumbnailFileKey(recipe);
    const uploadDetails = (await this.createSignedUploadUrl(
      fileName,
      ConfigProvider.BRANDING_BUCKET,
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
    return fileKey;
  }

  private static recipeThumbnailFileKey(recipe: BrandingRecipe) {
    const fileName = RecipeService.thumbnailFileName(recipe);
    const fileKey = `${recipe.brandingId}/recipes/${recipe.id}/thumbnail/${fileName}`;
    return { fileName, fileKey };
  }

  async completeLogoUpload(fileKey: string): Promise<void> {
    const id = fileKey.split("/")[0];
    if (!id) {
      throw new UserError("Invalid fileKey");
    }
    const brandingProfile = await this.repo.get({ id });
    if (!brandingProfile) {
      throw new UserError("Invalid fileKey");
    }

    const logoData = brandingProfile.logos?.entries?.find(
      (e) => e.fileKey === fileKey
    );
    if (!logoData) {
      throw new UserError("Invalid fileKey");
    }
    if (logoData.status === BrandingLogoStatus.UPLOADED) {
      throw new UserError(
        "Logo has already been marked as uploaded. Duplicate trigger?"
      );
    }

    const logo = await this.getObject(ConfigProvider.BRANDING_BUCKET, fileKey);
    const [fileName, extension] = fileKey.split(".");
    const webpFileKey = `${fileName}.webp`;
    await this.uploadObject(
      ConfigProvider.BRANDING_BUCKET,
      webpFileKey,
      await rescaleImage(await convertImageToWebp(logo), {
        width: 512,
        height: 512,
        withoutEnlargement: true,
      })
    );

    if (brandingProfile.logos.primaryEntry === logoData.fileKey) {
      brandingProfile.logos.primaryEntry = webpFileKey;
    }
    logoData.fileKey = webpFileKey;
    logoData.status = BrandingLogoStatus.UPLOADED;
    await this.repo.update({ id }, [
      { path: "/logos", op: "replace", value: brandingProfile.logos },
    ]);

    await this.deleteObject(ConfigProvider.BRANDING_BUCKET, fileKey);
  }

  async delLogo(userId: string, fileKey: string): Promise<BrandingEntity> {
    const currentData = await this.get(userId);
    if (!currentData.logos?.entries?.map((e) => e.fileKey).includes(fileKey)) {
      throw new UserError("Invalid fileKey");
    }

    const logos = {
      entries: currentData.logos.entries.filter((e) => e.fileKey !== fileKey),
      primaryEntry: currentData.logos.primaryEntry,
    };

    if (currentData.logos.primaryEntry === fileKey) {
      if (logos.entries.length) {
        logos.primaryEntry = logos.entries[0].fileKey;
      } else {
        delete logos.primaryEntry;
      }
    }

    await this.deleteObject(ConfigProvider.BRANDING_BUCKET, fileKey);
    return await this.repo.update({ id: currentData.id }, [
      {
        op: "replace",
        path: "/logos",
        value: logos,
      },
    ]);
  }
}
