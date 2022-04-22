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

@injectable()
export class UserService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;
  @inject(TYPES.UserRepo) userRepo: Repo<User>;
  ipApi = new IpApi();

  async fetchUser(uid: string): Promise<User | void> {
    return this.userRepo.get({ id: uid });
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
    return await this.userRepo.create(newUser);
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
    uid: string,
    favourites: FavouriteRecipe[]
  ): Promise<User> {
    const profile = await this.fetchUser(uid);
    if (!profile) {
      throw new UserError(`No user for id(${uid})`);
    }
    return await this.userRepo.update(
      { id: uid },
      [{ path: "/favouriteRecipes", op: "replace", value: favourites }],
      profile
    );
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
