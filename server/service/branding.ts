import "reflect-metadata";
import { injectable } from "inversify";
import { IService } from "server/service";
import ModelHelper from "server/models/helper";
import {
  BrandingDocument,
  brandingLogoStatus,
  BrandingModel,
} from "server/models/branding";
import { UserError } from "server/base/errors";

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
  model = BrandingModel;

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
          entries: { fileKey: string; status: brandingLogoStatus }[];
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
            ?.filter((entry) => entry.status === brandingLogoStatus.UPLOADED)
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
}
