import "reflect-metadata";
import { PresignedPost } from "aws-sdk/clients/s3";
import { DateTime } from "luxon";
import { inject, injectable } from "inversify";
import { UserError, UserErrorCode } from "server/base/errors";
import ConfigProvider from "server/base/ConfigProvider";
import {
  copyObject,
  createDestinationFileKey,
  createSignedUploadUrl,
  deleteObject,
  getObject,
  GetSignedUrlOperation,
  uploadObject,
  doesObjectExist,
} from "server/external/s3";
import logger from "server/base/Logger";
import { IService } from "server/service";
import { UpdateOperations } from "server/repositories";
import {
  BrandingEntity,
  BrandingLogo,
  BrandingLogoFromUploadsSource,
  BrandingLogosEntity,
  BrandingLogoStatus,
  BrandingUpdatePaths,
  MAX_LOGOS,
} from "server/repositories/branding";
import {
  convertImageToWebp,
  rescaleImageAsObj,
} from "server/helpers/imageUtils";
import { TYPES } from "server/types";
import { Repo } from "server/repositories/base";
import { BlendToRecipeConverter } from "server/engine/blend/recipeConverter";
import { BrandingRecipe } from "server/base/models/brandingRecipe";
import { ElementSource, StoredImage } from "server/base/models/recipe";
import { RecipeList, RecipeSource } from "server/base/models/recipeList";
import { RemoveBGSource } from "server/base/models/removeBg";
import { fireAndForget } from "server/helpers/async-runner";
import { VALID_UPLOAD_IMAGE_EXTENSIONS } from "server/helpers/constants";
import { sharpInstance } from "server/helpers/sharpUtils";
import DynamoDB from "server/external/dynamodb";
import { withExponentialBackoffRetries } from "server/helpers/general";
import VesApi, { ExportRequestSchema } from "server/internal/ves";
import { RemoveBgService } from "server/internal/remove-bg-service";
import { replaceUriPrefix } from "server/helpers/fileKeyUtils";
import { IllegalBlendAccessError } from "server/base/errors/engine/blendEngineErrors";
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
  @inject(TYPES.RemoveBgService) removeBgService: RemoveBgService;
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  // Required as class attributes for mocking
  createDestinationFileKey = createDestinationFileKey;
  createSignedUploadUrl = createSignedUploadUrl;
  deleteObject = deleteObject;
  uploadObject = uploadObject;
  getObject = getObject;
  doesObjectExist = doesObjectExist;

  async get(userId: string): Promise<BrandingEntity> {
    return (await this.repo.query({ userId }))[0];
  }

  async getOrFail(userId: string): Promise<BrandingEntity> {
    const profile = await this.get(userId);
    if (!profile) {
      throw new UserError(
        "Branding Profile Not Found",
        UserErrorCode.BRANDING_PROFILE_NOT_FOUND
      );
    }
    return profile;
  }

  async getOrCreate(userId: string): Promise<BrandingEntity> {
    let existingProfile: BrandingEntity;
    try {
      existingProfile = await withExponentialBackoffRetries(
        (userId: string) => this.getOrFail(userId),
        { fnArgs: [userId], backOffFactorInMS: 20 }
      );
    } catch (e) {
      if ((e as UserError).code !== UserErrorCode.BRANDING_PROFILE_NOT_FOUND) {
        throw e;
      }
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
            ?.filter((entry) =>
              [
                BrandingLogoStatus.UPLOADED,
                BrandingLogoStatus.PROCESSED,
              ].includes(entry.status)
            )
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
    removeBg: boolean
  ): Promise<{ url: string }> {
    const currentData = await this.get(userId);
    const uploadedLogos = this.getUploadedLogos(currentData);
    this.validateLogoCount(uploadedLogos);

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
                removeBg,
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

  async copyLogoFromUploads(
    userId: string,
    source: BrandingLogoFromUploadsSource,
    fileKey: string
  ) {
    const currentData = await this.get(userId);
    const uploadedLogos = this.getUploadedLogos(currentData);
    this.validateLogoCount(uploadedLogos);

    const logo = await getObject(ConfigProvider.HERO_IMAGES_BUCKET, fileKey);
    const fileKeyParts = fileKey.split("/");
    const fileKeyWithoutPrefix = fileKeyParts[fileKeyParts.length - 1];
    const brandingFileKey = `${currentData.id}/${fileKeyWithoutPrefix}`;
    const { fileKey: optimizedFileKey, info } =
      await this.optimizeAndUploadLogo(logo, brandingFileKey);

    return await this.repo.update(
      { id: currentData.id },
      [
        {
          path: "/logos",
          op: "replace",
          value: {
            entries: [
              ...uploadedLogos,
              {
                status: BrandingLogoStatus.PROCESSED,
                fileKey: optimizedFileKey,
                size: { width: info.width, height: info.height },
                removeBg: false,
              },
            ],
            // If no uploaded logos exist, mark this as primary
            primaryEntry:
              uploadedLogos.length === 0
                ? optimizedFileKey
                : currentData.logos.primaryEntry,
          },
        },
      ],
      currentData
    );
  }

  getUploadedLogos(branding: BrandingEntity) {
    return (
      branding.logos?.entries?.filter((entry) =>
        [BrandingLogoStatus.UPLOADED, BrandingLogoStatus.PROCESSED].includes(
          entry.status
        )
      ) || []
    );
  }

  validateLogoCount(logos: BrandingLogo[]) {
    if (logos.length >= MAX_LOGOS) {
      throw new UserError(`You can't have more than ${MAX_LOGOS} logos`);
    }
  }

  async addRecipe(
    userId: string,
    sourceBlendId: string,
    isUserAnonymous: boolean,
    heroAssetUids?: string[],
    backgroundAssetUid?: string
  ) {
    const branding = await this.getOrCreate(userId);

    const blend = await this.blendService.getBlend(sourceBlendId, {
      consistentRead: true,
    });
    if (userId !== blend.createdBy) {
      IllegalBlendAccessError.logIllegalBlendAccess(
        blend.id,
        blend.createdBy,
        userId,
        isUserAnonymous
      );
      // Don't let the possible attacker know that this is a valid blend id.
      throw new UserError("Invalid sourceBlendId");
    }

    const blendToRecipeConverter = new BlendToRecipeConverter(blend);
    const brandingRecipe = blendToRecipeConverter.convert(
      heroAssetUids,
      backgroundAssetUid
    ) as BrandingRecipe;
    brandingRecipe.userId = userId;
    brandingRecipe.brandingId = branding.id;

    const imageDestinationURIs = BlendToRecipeConverter.imageDestinationURIs(
      brandingRecipe.images.filter(StoredImage.isSourceBlend),
      ElementSource.branding,
      brandingRecipe.id,
      branding.id
    );
    await Promise.all(
      brandingRecipe.images.map((image) => {
        if (StoredImage.isSourceBlend(image)) {
          return copyObject(
            ConfigProvider.BLEND_INGREDIENTS_BUCKET,
            image.uri,
            ConfigProvider.BRANDING_BUCKET,
            imageDestinationURIs[image.uid]
          );
        }
        return Promise.resolve();
      })
    );
    brandingRecipe.images = brandingRecipe.images.map((image) => {
      if (StoredImage.isSourceBlend(image)) {
        return {
          ...image,
          uri: imageDestinationURIs[image.uid],
          source: ElementSource.branding,
        };
      }
      return image;
    });
    brandingRecipe.thumbnail = await this.generateRecipeThumbnail(
      brandingRecipe
    );

    brandingRecipe.createdOn = brandingRecipe.updatedOn =
      DateTime.utc().toISODate();
    return await this.brandingRecipeRepo.createWithoutSurrogateKey(
      brandingRecipe
    );
  }

  isValidbuildVersion(buildVersion: number) {
    return (
      ConfigProvider.BRANDING_BUILD_VERSION &&
      buildVersion >= ConfigProvider.BRANDING_BUILD_VERSION
    );
  }

  async addToRecipeLists(
    buildVersion: number,
    userId: string,
    recipeLists: RecipeList[]
  ) {
    if (!this.isValidbuildVersion(buildVersion)) {
      return recipeLists;
    }
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
    if (
      !(await this.doesObjectExist(ConfigProvider.BRANDING_BUCKET, fileKey))
    ) {
      // Ignore. Possibly an edge case where either
      // - the asset explicitly got deleted immediately after upload
      // - or the asset was migrated from a anonymous branding profile to a user branding profile
      return;
    }

    const id = fileKey.split("/")[0];
    const brandingProfile = await this.repo.get({ id });
    if (!brandingProfile) {
      throw new UserError(
        "Branding profile with the id in the fileKey not found"
      );
    }

    const logoData = brandingProfile.logos?.entries?.find(
      (e) => e.fileKey === fileKey
    );
    if (!logoData) {
      // Ignore. Either
      // - not a logo upload
      // - logo got deleted immediately
      return;
    }
    if (logoData.status === BrandingLogoStatus.PROCESSED) {
      logger.debug(
        "Logo has already been marked as processed. Duplicate trigger?"
      );
      return;
    }

    // This intermediary status update is necessary for the client to not end up waiting
    // for post processings, especially bg-removal if required, to complete.
    logoData.status = BrandingLogoStatus.UPLOADED;
    await this.repo.update({ id }, [
      { path: "/logos", op: "replace", value: brandingProfile.logos },
    ]);

    let logo = await this.getObject(ConfigProvider.BRANDING_BUCKET, fileKey);
    const [fileNameWithExt] = fileKey.split("/").slice(-1);
    const [fileExtension] = fileNameWithExt.split(".").slice(-1);
    logo = await (
      await sharpInstance(logo, { failOnError: false }, fileExtension)
    ).toBuffer();
    let bgRemovedFileKey: string;
    if (logoData.removeBg) {
      ({ bgRemovedFileKey, bgRemovegLogo: logo } = await this.removeBg(
        fileKey,
        logo
      ));
    }

    const { fileKey: optimizedFileKey, info } =
      await this.optimizeAndUploadLogo(
        logo,
        logoData.removeBg ? bgRemovedFileKey : fileKey
      );

    if (brandingProfile.logos.primaryEntry === logoData.fileKey) {
      brandingProfile.logos.primaryEntry = optimizedFileKey;
    }
    logoData.fileKey = optimizedFileKey;
    logoData.status = BrandingLogoStatus.PROCESSED;
    logoData.size = {
      width: info.width,
      height: info.height,
    };
    await this.repo.update({ id }, [
      { path: "/logos", op: "replace", value: brandingProfile.logos },
    ]);

    await this.deleteObject(ConfigProvider.BRANDING_BUCKET, fileKey);
  }

  async optimizeAndUploadLogo(logo: Buffer, fileKey: string) {
    const { data: optimizedLogo, info } = await rescaleImageAsObj(
      await convertImageToWebp(logo),
      {
        width: 512,
        withoutEnlargement: true,
      }
    );
    const fileName = fileKey.split(".")[0];
    const optimizedFileKey = `${fileName}-optimized.webp`;
    await this.uploadObject(
      ConfigProvider.BRANDING_BUCKET,
      optimizedFileKey,
      optimizedLogo
    );
    return { fileKey: optimizedFileKey, info };
  }

  async removeBg(fileKey: string, logo: Buffer) {
    const { bgRemovedFileKey } =
      RemoveBgService.constructBgRemovedFileKey(fileKey);
    const [fileNameWithoutPrefix] = fileKey.split("/").slice(-1);
    const metadata = {
      source: RemoveBGSource.BRANDING,
      fileKeys: {
        original: fileKey,
        withoutBg: bgRemovedFileKey,
      },
    };
    const bgRemovegLogo = (
      await this.removeBgService.removeBg(
        logo,
        fileNameWithoutPrefix,
        true,
        false,
        metadata
      )
    ).buffer;
    return { bgRemovedFileKey, bgRemovegLogo };
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

  async migrateProfile(sourceUid: string, targetUid: string) {
    logger.info({ op: "MIGRATE_BRANDING_PROFILE", sourceUid, targetUid });
    const targetBranding = await this.getOrCreate(targetUid);
    const sourceBranding = await this.get(sourceUid);
    if (sourceBranding) {
      sourceBranding.info.forEach((sourceItem) => {
        const targetItem = targetBranding.info.find(
          (targetItem) => targetItem.type === sourceItem.type
        );
        if (targetItem) {
          targetItem.link = sourceItem.link;
          targetItem.value = sourceItem.value;
        } else {
          targetBranding.info.push(sourceItem);
        }
      });
      if (!targetBranding.logos.entries.length) {
        targetBranding.logos = await this.migrateLogos(
          sourceBranding.logos,
          targetBranding.id
        );
      } else {
        // It's complicated to merge. Retain the older set.
      }
    }
    await this.repo.updatePartial(
      { id: targetBranding.id },
      {
        info: targetBranding.info,
        logos: targetBranding.logos,
      }
    );
    if (sourceBranding) {
      await this.repo.delete({ id: sourceBranding.id });
    }

    await this.migrateRecipes(sourceUid, targetUid, targetBranding.id);
  }

  async migrateLogos(source: BrandingLogosEntity, targetBrandingId: string) {
    const promises = [];
    source.entries.forEach((e) => {
      const { fileKey } = e;
      const newFileKey = replaceUriPrefix(fileKey, targetBrandingId);
      promises.push(
        copyObject(
          ConfigProvider.BRANDING_BUCKET,
          fileKey,
          ConfigProvider.BRANDING_BUCKET,
          newFileKey
        ).then(() => deleteObject(ConfigProvider.BRANDING_BUCKET, fileKey))
      );
      e.fileKey = newFileKey;
      if (source.primaryEntry === fileKey) {
        source.primaryEntry = newFileKey;
      }
    });
    await Promise.all(promises);
    return source;
  }

  async migrateRecipes(
    sourceUid: string,
    targetUid: string,
    targetBrandingId: string
  ) {
    const recipes = await this.getRecipes(sourceUid);
    if (recipes.length > 0) {
      const updatePromises = [];
      recipes.forEach((r) => {
        const imagePromises = [];
        r.images.forEach((i) => {
          const { uri } = i;
          const newUri = replaceUriPrefix(uri, targetBrandingId);
          imagePromises.push(
            copyObject(
              ConfigProvider.BRANDING_BUCKET,
              uri,
              ConfigProvider.BRANDING_BUCKET,
              newUri
            ).then(() => deleteObject(ConfigProvider.BRANDING_BUCKET, uri))
          );
          i.uri = newUri;
        });
        const { thumbnail: thumbnailURI } = r;
        if (thumbnailURI) {
          const newThumbnailURI = replaceUriPrefix(
            thumbnailURI,
            targetBrandingId
          );
          imagePromises.push(
            copyObject(
              ConfigProvider.BRANDING_BUCKET,
              thumbnailURI,
              ConfigProvider.BRANDING_BUCKET,
              newThumbnailURI
            ).then(() =>
              deleteObject(ConfigProvider.BRANDING_BUCKET, thumbnailURI)
            )
          );
          r.thumbnail = newThumbnailURI;
        }
        updatePromises.push(
          Promise.all(imagePromises).then(() =>
            this.brandingRecipeRepo.updatePartial(
              {
                id: r.id,
                variant: r.variant,
              },
              {
                brandingId: targetBrandingId,
                createdBy: targetUid,
                userId: targetUid,
                images: r.images,
                thumbnail: r.thumbnail,
              }
            )
          )
        );
      });
    }
  }
}
