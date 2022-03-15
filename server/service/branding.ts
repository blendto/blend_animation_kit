import "reflect-metadata";
import { injectable } from "inversify";
import { UserError } from "server/base/errors";
import ConfigProvider from "server/base/ConfigProvider";
import {
  createDestinationFileKey,
  createSignedUploadUrl,
  deleteObject,
  GetSignedUrlOperation,
} from "server/external/s3";
import { IService } from "server/service";
import ModelHelper from "server/models/helper";
import {
  BrandingDocument,
  BrandingLogoStatus,
  BrandingModel,
  MAX_LOGOS,
} from "server/models/branding";

export enum validUpdatePaths {
  email = "email",
  contactNo = "contactNo",
  whatsappNo = "whatsappNo",
  instaHandle = "instaHandle",
  website = "website",
  address = "address",
  primaryLogo = "logos.primaryEntry",
}

export enum validUpdateOperationsOnPrimaryLogo {
  add = "add",
  replace = "replace",
}

export enum validUpdateOperations {
  add = "add",
  replace = "replace",
  remove = "remove",
}

@injectable()
export default class BrandingService implements IService {
  validExtensions = ["png", "jpg", "jpeg", "webp"];
  model = BrandingModel;

  // Required as class attributes for mocking
  createDestinationFileKey = createDestinationFileKey;
  createSignedUploadUrl = createSignedUploadUrl;
  deleteObject = deleteObject;

  private async create(params: { userId: string }): Promise<BrandingDocument> {
    return await ModelHelper.createWithId<BrandingDocument>(this.model, params);
  }

  private async get(userId: string): Promise<BrandingDocument> {
    return (await this.model.query({ userId }).exec())[0];
  }

  async getOrCreate(userId: string): Promise<BrandingDocument> {
    let existingProfile = await this.get(userId);
    if (!existingProfile) {
      existingProfile = await this.create({ userId });
    }
    return existingProfile;
  }

  async update(
    userId: string,
    changes: {
      path: validUpdatePaths;
      op: validUpdateOperations;
      value?: string;
    }[]
  ): Promise<BrandingDocument> {
    const currentData = await this.getOrCreate(userId);
    const updateSet: {
      $SET: {
        email?: string;
        contactNo?: string;
        whatsappNo?: string;
        instaHandle?: string;
        website?: string;
        address?: string;
        logos?: {
          primaryEntry: string;
          entries: { fileKey: string; status: BrandingLogoStatus }[];
        };
      };
      $REMOVE: validUpdatePaths[];
    } = {
      $SET: {},
      $REMOVE: [],
    };

    changes.forEach((change) => {
      if (
        [validUpdateOperations.add, validUpdateOperations.replace].includes(
          change.op
        )
      ) {
        if (change.path === validUpdatePaths.primaryLogo) {
          const validLogoKeys = currentData.logos?.entries
            ?.filter((entry) => entry.status === BrandingLogoStatus.UPLOADED)
            .map((entry) => entry.fileKey);
          if (!validLogoKeys.includes(change.value)) {
            throw new UserError(
              "Primary logo is pointing to an invalid file key"
            );
          }
          // Dynamoose doesn't support nested updates on maps. Override.
          updateSet.$SET.logos = {
            primaryEntry: change.value,
            entries: currentData.logos.entries,
          };
        } else {
          updateSet.$SET[change.path] = change.value;
        }
      } else {
        if (change.path === validUpdatePaths.primaryLogo) {
          throw new UserError("Primary logo pointer can't be unset");
        }
        updateSet.$REMOVE.push(change.path);
      }
    });

    return (await this.model.update(
      { id: currentData.id },
      updateSet as object
    )) as unknown as BrandingDocument;
  }

  async initLogoUpload(userId: string, fileName: string): Promise<object> {
    const currentData: BrandingDocument = await this.getOrCreate(userId);
    const uploadedLogos =
      currentData.logos?.entries?.filter(
        (entry) => entry.status === BrandingLogoStatus.UPLOADED
      ) || [];
    if (uploadedLogos.length >= MAX_LOGOS) {
      throw new UserError("You can't have more than 3 logos");
    }

    const updateSet = {
      $SET: {
        logos: {
          ...currentData.logos,
          // If there are INITIALIZED logos, their upload probably failed in between.
          // Assume so and delete them from the profile.
          entries: uploadedLogos,
        },
      },
    };

    const fileKey = this.createDestinationFileKey(
      fileName,
      this.validExtensions,
      `${currentData.id}/`
    );
    updateSet.$SET.logos.entries.push({
      status: BrandingLogoStatus.INITIALIZED,
      fileKey,
    });
    if (updateSet.$SET.logos.entries.length === 1) {
      // If there are logos, one should be primary
      updateSet.$SET.logos.primaryEntry = fileKey;
    }

    const uploadURL = await this.createSignedUploadUrl(
      fileName,
      ConfigProvider.BRANDING_BUCKET,
      this.validExtensions,
      { outFileKey: fileKey },
      GetSignedUrlOperation.putObject
    );

    await this.model.update({ id: currentData.id }, updateSet as object);
    return { url: uploadURL } as object;
  }

  async delLogo(userId: string, fileKey: string): Promise<void> {
    const currentData: BrandingDocument = await this.getOrCreate(userId);
    if (!currentData.logos?.entries?.map((e) => e.fileKey).includes(fileKey)) {
      throw new UserError("Invalid fileKey");
    }

    const updateSet = {
      $SET: {
        logos: {
          ...currentData.logos,
          entries: currentData.logos.entries.filter(
            (e) => e.fileKey !== fileKey
          ),
        },
      },
    };

    if (currentData.logos.primaryEntry === fileKey) {
      if (updateSet.$SET.logos.entries.length) {
        updateSet.$SET.logos.primaryEntry =
          updateSet.$SET.logos.entries[0].fileKey;
      } else {
        delete updateSet.$SET.logos.primaryEntry;
      }
    }

    await this.deleteObject(ConfigProvider.BRANDING_BUCKET, fileKey);
    await this.model.update({ id: currentData.id }, updateSet as object);
  }
}
