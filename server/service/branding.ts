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
import {
  BrandingEntity,
  BrandingLogoStatus,
  brandingRepo,
  MAX_LOGOS,
  BrandingUpdatePaths,
  BrandingUpdateOperations,
} from "server/repositories/branding";

@injectable()
export default class BrandingService implements IService {
  validExtensions = ["png", "jpg", "jpeg", "webp"];
  repo = brandingRepo;

  // Required as class attributes for mocking
  createDestinationFileKey = createDestinationFileKey;
  createSignedUploadUrl = createSignedUploadUrl;
  deleteObject = deleteObject;

  private async get(userId: string): Promise<BrandingEntity> {
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
      op: BrandingUpdateOperations;
      value?: unknown;
    }[]
  ): Promise<BrandingEntity> {
    const currentData = await this.getOrCreate(userId);

    changes.forEach((change) => {
      if (change.path === BrandingUpdatePaths.primaryLogo) {
        if (
          [
            BrandingUpdateOperations.add,
            BrandingUpdateOperations.replace,
          ].includes(change.op)
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

    return await this.repo.updateWithFormatted(currentData, changes);
  }

  async initLogoUpload(
    userId: string,
    fileName: string
  ): Promise<{ url: string }> {
    const currentData = await this.getOrCreate(userId);
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
      { outFileKey: fileKey },
      GetSignedUrlOperation.putObject
    )) as string;

    await this.repo.update({ id: currentData.id }, [
      {
        path: "logos",
        op: "replace",
        value: {
          entries: [
            // If there are initialized logos, their upload probably failed in between.
            // Assume so and delete them from the profile.
            ...uploadedLogos,
            {
              status: BrandingLogoStatus.INITIALIZED,
              fileKey,
            },
          ],
          // If no uploaded logos exist, mark this as primary
          primaryEntry:
            uploadedLogos.length === 0
              ? fileKey
              : currentData.logos.primaryEntry,
        },
      },
    ]);
    return { url: uploadURL };
  }

  async markLogoUploadAsDone(fileKey: string): Promise<void> {
    const id = fileKey.split("/")[0];
    if (!id) {
      throw new UserError("Invalid fileKey");
    }
    const brandingProfile = await this.repo.get({ id });
    if (!brandingProfile) {
      throw new UserError("Invalid fileKey");
    }

    const logo = brandingProfile.logos?.entries?.find(
      (e) => e.fileKey === fileKey
    );
    if (!logo) {
      throw new UserError("Invalid fileKey");
    }
    if (logo.status === BrandingLogoStatus.UPLOADED) {
      throw new UserError(
        "Logo has already been marked as uploaded. Duplicate trigger?"
      );
    }

    const { logos } = brandingProfile;
    logos.entries.forEach((e) => {
      if (e.fileKey === fileKey) {
        e.status = BrandingLogoStatus.UPLOADED;
      }
    });
    await this.repo.update({ id }, [
      { path: "logos", op: "replace", value: logos },
    ]);
  }

  async delLogo(userId: string, fileKey: string): Promise<BrandingEntity> {
    const currentData = await this.getOrCreate(userId);
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
        path: "logos",
        value: logos,
      },
    ]);
  }
}
