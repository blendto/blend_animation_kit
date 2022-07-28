import { FavouriteRecipe, User } from "server/base/models/user";
import DynamoDB from "server/external/dynamodb";
import "reflect-metadata";
import referralCodeGenerator from "referral-code-generator";
import randomName from "node-random-name";
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
import { SuggestionService } from "server/service/suggestion";

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

  async getOrCreate(id: string): Promise<User> {
    let profile = await this.repo.get({ id });
    if (!profile) {
      profile = await this.populateUserFromFirebase(id);
    }
    if (!profile.referralId) {
      profile = await this.addReferralIdAndLink(profile);
    }
    profile.favouriteRecipes = await this.fetchDetailedFavourites(
      profile.favouriteRecipes
    );
    return profile;
  }

  async getWithReferralId(referralId: string): Promise<User | null> {
    const profiles = await this.repo.query({ referralId });
    if (profiles.length > 0) {
      return profiles[0];
    }
    return null;
  }

  async update(id: string, changes: UserJSONUpdate[]): Promise<User> {
    const profile = await this.repo.update({ id }, changes);
    profile.favouriteRecipes = await this.fetchDetailedFavourites(
      profile.favouriteRecipes
    );
    return profile;
  }

  generateReferralId(profile: User): string {
    // Ensure referral id has a relatable prefix by using the email id if available.
    // If not, generate a random real-world name.
    let username = profile.email;
    if (!username) {
      /* eslint-disable-next-line
        @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
      username = randomName() as string;
    }
    /* eslint-disable-next-line
      @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    return referralCodeGenerator.custom("lowercase", 4, 4, username) as string;
  }

  async generateReferralLink(referralId: string): Promise<string> {
    return await diContainer
      .get<Firebase>(TYPES.Firebase)
      .createDynamicLink(
        `${ConfigProvider.SELF_BASE_PATH}/signup?referralId=${referralId}`
      );
  }

  async addReferralIdAndLink(profile: User): Promise<User> {
    const referralId = this.generateReferralId(profile);
    if (await this.getWithReferralId(referralId)) {
      return await this.addReferralIdAndLink(profile);
    }
    const referralLink = await this.generateReferralLink(referralId);
    return await this.repo.update({ id: profile.id }, [
      {
        op: "add",
        path: "/referralId",
        value: referralId,
      },
      {
        op: "add",
        path: "/referralLink",
        value: referralLink,
      },
    ]);
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
    const profile = await this.repo.update({ id }, [
      { path: "/favouriteRecipes", op: "replace", value: favourites },
    ]);
    profile.favouriteRecipes = await this.fetchDetailedFavourites(
      profile.favouriteRecipes
    );
    return profile;
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

  private async fetchDetailedFavourites(
    favouriteRecipes: FavouriteRecipe[]
  ): Promise<FavouriteRecipe[]> {
    const suggestionService = diContainer.get<SuggestionService>(
      TYPES.SuggestionService
    );
    const promises = favouriteRecipes.map(async (favourite) => {
      const { recipeId: id, recipeVariant: variant } = favourite;
      const fullRecipe = await suggestionService.backfillRecipeDetails({
        id,
        variant,
      });
      return { ...favourite, fullRecipe };
    });
    return Promise.all(promises);
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
