import { FavouriteRecipe, User } from "server/base/models/user";
import DynamoDB from "server/external/dynamodb";
import "reflect-metadata";
import ConfigProvider from "server/base/ConfigProvider";
import { BlendService } from "server/service/blend";
import { IService } from "server/service";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";
import { inject, injectable } from "inversify";
import IpApi from "server/external/ipapi";
import { UserAgentDetails } from "server/base/models/userAgentDetails";
import logger from "server/base/Logger";
import { UserError } from "server/base/errors";
import Firebase from "server/external/firebase";
import { Repo } from "server/repositories/base";
import { UserUpdatePaths } from "server/repositories/user";
import { UpdateOperations } from "server/repositories";

export type UserJSONUpdate = {
  path: UserUpdatePaths;
  op: UpdateOperations;
  value?: unknown;
};

@injectable()
export class UserService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.UserRepo) repo: Repo<User>;
  ipApi = new IpApi();

  async fetch(id: string): Promise<User | void> {
    return this.repo.get({ id });
  }

  async update(id: string, changes: UserJSONUpdate[]): Promise<User> {
    return await this.repo.update({ id }, changes);
  }

  async populateUserFromFirebase(userId: string): Promise<User> {
    const firebaseService = diContainer.get<Firebase>(TYPES.Firebase);

    const userRecord = await firebaseService.getUserById(userId);
    const { email, displayName, phoneNumber, uid, photoURL } = userRecord;

    if (!email && !phoneNumber) {
      throw new UserError("User not verified");
    }

    const newUser: User = {
      id: uid,
      email,
      name: displayName,
      phone: phoneNumber,
      socialHandles: {},
      profilePicture: photoURL,
      activitySummary: { posts: 0, shoutoutsReceived: 0 },
      createdAt: Date.parse(userRecord.metadata.creationTime),
      updatedAt: Date.now(),
      favouriteRecipes: [],
    };
    return await this.repo.create(newUser);
  }

  async migrateUserBlends(
    sourceUid: string,
    targetUid: string
  ): Promise<string[]> {
    const blendService = diContainer.get<BlendService>(TYPES.BlendService);
    const blendIds = await blendService.getBlendIdsForUser(sourceUid);
    const updates = blendIds.map(async (blendId) => {
      await this.updateBlendOwner(blendId, targetUid);
      return blendId;
    });
    return await Promise.all(updates);
  }

  async updateFavouriteRecipes(
    id: string,
    favourites: FavouriteRecipe[]
  ): Promise<User> {
    return await this.repo.update({ id }, [
      { path: "/favouriteRecipes", op: "replace", value: favourites },
    ]);
  }

  async getUserAgent(ip: string): Promise<UserAgentDetails | null> {
    if (!ip) {
      return null;
    }

    try {
      const ipDetails = (await this.ipApi.getIpInfo(ip)) as Record<
        string,
        string
      >;
      return new UserAgentDetails(ipDetails.country_code);
    } catch (err) {
      logger.error(err);
      return null;
    }
  }

  private async updateBlendOwner(blendId: string, newUid: string) {
    await this.dataStore.updateItem({
      UpdateExpression: "SET #updatedAt = :updatedAt, #createdBy = :createdBy",
      ExpressionAttributeNames: {
        "#updatedAt": "updatedAt",
        "#createdBy": "createdBy",
      },
      ExpressionAttributeValues: {
        ":updatedAt": Date.now(),
        ":createdBy": newUid,
      },
      Key: { id: blendId },
      TableName: ConfigProvider.BLEND_DYNAMODB_TABLE,
      ReturnValues: "NONE",
    });
  }
}
