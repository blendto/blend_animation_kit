import "reflect-metadata";
import admin from "firebase-admin";
import { nanoid } from "nanoid";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { NextApiRequest } from "next";
import { injectable } from "inversify";
import UserError, { UserErrorCode } from "server/base/errors/UserError";
import ConfigProvider from "../base/ConfigProvider";

export enum FirebaseDynamicLinkSuffixType {
  SHORT = "SHORT",
  UNGUESSABLE = "UNGUESSABLE",
}

@injectable()
export default class Firebase {
  FIREBASE_PROJECT_ID = ConfigProvider.FIREBASE_APP_CLIENT_CONFIG
    .projectId as string;
  FIREBASE_DYNAMIC_LINKS = {
    url: `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${ConfigProvider.FIREBASE_APP_CLIENT_CONFIG.apiKey}`,
    domainURIPrefix: "https://links.blend.to",
    androidPackageName: "to.blend.mobile_app",
    iosBundleId: "to.blend.mobile-app",
  };

  constructor() {
    if (admin.apps.length !== 0) {
      // Already initialized, else causes problems during hot-reloading
      return;
    }
    firebase.initializeApp(ConfigProvider.FIREBASE_APP_CLIENT_CONFIG);
    admin.initializeApp({
      credential: admin.credential.cert(ConfigProvider.FIREBASE_SERVICE_KEY),
    });
  }

  async verifyAndDecodeToken(idToken: string) {
    try {
      const claims = await admin.auth().verifyIdToken(idToken);
      if (claims.aud !== this.FIREBASE_PROJECT_ID) {
        throw new UserError("Invalid Token");
      }
      return claims;
    } catch (e) {
      throw new UserError("Invalid Token");
    }
  }

  async createTemporaryUser(): Promise<firebase.User> {
    const userRecord = await admin.auth().createUser({
      uid: nanoid(16),
    });
    const token: string = await admin.auth().createCustomToken(userRecord.uid);
    const userCredential = await firebase.auth().signInWithCustomToken(token);
    return userCredential.user;
  }

  async loginFakeUser(): Promise<firebase.User> {
    const userRecord = await admin
      .auth()
      .getUserByEmail("engineering+test-user@blend.to");
    const token: string = await admin.auth().createCustomToken(userRecord.uid);
    const userCredential = await firebase.auth().signInWithCustomToken(token);
    return userCredential.user;
  }

  async extractUserIdFromRequest(request: NextApiRequest): Promise<string> {
    const authHeader = request.headers?.authorization;
    if (!authHeader?.startsWith("Bearer")) {
      return null;
    }
    const claims = await this.verifyAndDecodeToken(authHeader.substring(7));
    return claims.uid;
  }

  async withUserErrorHandler(res: Promise<admin.auth.UserRecord | void>) {
    try {
      return await res;
    } catch (e) {
      const errCode = (e as Record<string, unknown>).code;
      if (errCode === "auth/user-not-found") {
        throw new UserError("User Not Found", UserErrorCode.USER_NOT_FOUND);
      } else if (errCode === "auth/invalid-uid") {
        throw new UserError("Invalid User Id", UserErrorCode.INVALID_USER_ID);
      }
      throw new Error(`Something went wrong: ${errCode}`);
    }
  }

  async getUserById(id: string) {
    return (await this.withUserErrorHandler(
      admin.auth().getUser(id)
    )) as admin.auth.UserRecord;
  }

  async deleteUser(id: string) {
    return await this.withUserErrorHandler(admin.auth().deleteUser(id));
  }

  async getUserByIds(ids: string[]) {
    return await admin.auth().getUsers(ids.map((id) => ({ uid: id })));
  }

  async getUserByIdsOrFail(ids: string[]) {
    const { users, notFound } = await this.getUserByIds(ids);
    if (notFound.length > 0) {
      throw new UserError(
        `Following Users Not Found: ${notFound
          .map(
            (userIdentifier) =>
              (userIdentifier as unknown as { uid: string }).uid
          )
          .join(", ")}`,
        UserErrorCode.USER_NOT_FOUND
      );
    }
    return users;
  }
}
