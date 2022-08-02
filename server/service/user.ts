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
import Firebase from "server/external/firebase";
import { JSONPatch, Repo } from "server/repositories/base";
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

  private isAnonymous(profile: User): boolean {
    return !profile.email && !profile.phone;
  }

  async generateFirebaseData(id: string): Promise<{
    email: string;
    displayName: string;
    phoneNumber: string;
    photoURL: string;
    createdAt: number;
  }> {
    const firebaseRecord = await diContainer
      .get<Firebase>(TYPES.Firebase)
      .getUserById(id);
    return {
      email: firebaseRecord.email,
      displayName: firebaseRecord.displayName,
      phoneNumber: firebaseRecord.phoneNumber,
      photoURL: firebaseRecord.photoURL,
      createdAt: Date.parse(firebaseRecord.metadata.creationTime),
    };
  }

  async generateBaseData(id: string): Promise<User> {
    const { email, displayName, phoneNumber, photoURL, createdAt } =
      await this.generateFirebaseData(id);
    return {
      id,
      email,
      name: displayName,
      phone: phoneNumber,
      socialHandles: {},
      profilePicture: photoURL,
      activitySummary: { posts: 0, shoutoutsReceived: 0 },
      createdAt,
      updatedAt: Date.now(),
      favouriteRecipes: [],
    };
  }

  async generateBaseDataChanges(profile: Partial<User>): Promise<JSONPatch> {
    const baseData = await this.generateBaseData(profile.id);
    const changes: JSONPatch = [];
    Object.keys(baseData).forEach((attr) => {
      if (baseData[attr] && !profile[attr]) {
        changes.push({
          op: "add",
          path: `/${attr}`,
          value: baseData[attr],
        });
      }
    });
    return changes;
  }

  async generateReferralDataChanges(profile: User): Promise<JSONPatch> {
    const referralData = await this.generateReferralIdAndLink(profile);
    return [
      {
        op: "add",
        path: `/referralId`,
        value: referralData.referralId,
      },
      {
        op: "add",
        path: `/referralLink`,
        value: referralData.referralLink,
      },
    ];
  }

  async ensureProfileHasAllData(profile: User): Promise<User> {
    // Base data will be definitely and only filled post sign-up
    if (this.isAnonymous(profile)) {
      const changes = await this.generateBaseDataChanges(profile);
      if (changes.length) {
        profile = await this.repo.update({ id: profile.id }, changes);
      }
    }
    // Referral id will be generated only post sign-up
    if (!profile.referralId && !this.isAnonymous(profile)) {
      profile = await this.repo.update(
        { id: profile.id },
        await this.generateReferralDataChanges(profile)
      );
    }
    // In cases of both sign up and referral data missing, it's easy to think that we could
    // do with a single repo.update but really can't because referral data requires that sign up
    // data be present and hence we must do one after the other.
    return profile;
  }

  async getOrCreate(id: string): Promise<User> {
    let profile = await this.repo.get({ id });
    if (!profile) {
      profile = await this.create(id);
    }

    // Profiles could be missing partial/full data if it was
    // - created before sign up. Firebase will not have returned any data.
    // - created as part of an older update (when updates didn't care if a profile existed
    //   but rather simply created a new record with the attributes passed to the update).
    // - created before referral system was added.
    profile = await this.ensureProfileHasAllData(profile);

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
    let profile = await this.repo.update({ id }, changes);

    // If a profile didn't exist at this point, this.repo.update would create
    // entity with just the given attributes. Ensure the profile has all data.
    profile = await this.ensureProfileHasAllData(profile);

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

  async generateReferralIdAndLink(
    profile: User
  ): Promise<{ referralId: string; referralLink: string }> {
    let referralId: string;
    let referralLink: string;
    if (this.isAnonymous(profile)) {
      // Don't generate referral id before sign up. If the user signs up with email later,
      // we'd want to use the first 4 character from his email as the referral id prefix.
      return { referralId, referralLink };
    }
    referralId = this.generateReferralId(profile);
    if (await this.getWithReferralId(referralId)) {
      return await this.generateReferralIdAndLink(profile);
    }
    referralLink = await this.generateReferralLink(referralId);
    return { referralId, referralLink };
  }

  async create(userId: string): Promise<User> {
    let profile = await this.generateBaseData(userId);
    profile = {
      ...profile,
      ...(await this.generateReferralIdAndLink(profile)),
    };
    return await this.repo.create(profile);
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

    logger.info({ op: "MIGRATE_BLENDS", sourceUid, targetUid, blendIds });
    return await Promise.all(updates);
  }

  async updateFavouriteRecipes(
    id: string,
    favourites: FavouriteRecipe[]
  ): Promise<User> {
    return await this.update(id, [
      {
        path: UserUpdatePaths.favouriteRecipes,
        op: UpdateOperations.replace,
        value: favourites,
      },
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
