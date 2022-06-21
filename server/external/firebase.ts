import "reflect-metadata";
import admin from "firebase-admin";
import UserError from "server/base/errors/UserError";
import { nanoid } from "nanoid";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { NextApiRequest } from "next";
import { injectable } from "inversify";
import ConfigProvider from "../base/ConfigProvider";

export enum FirebaseErrCode {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  INVALID_USER_ID = "INVALID_USER_ID",
}

@injectable()
export default class Firebase {
  FIREBASE_PROJECT_ID = ConfigProvider.FIREBASE_APP_CLIENT_CONFIG
    .projectId as string;

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

  async getUserById(id: string) {
    try {
      return await admin.auth().getUser(id);
    } catch (e) {
      const errCode = (e as Record<string, unknown>).code;
      if (errCode === "auth/user-not-found") {
        throw new UserError("User Not Found", FirebaseErrCode.USER_NOT_FOUND);
      } else if (errCode === "auth/invalid-uid") {
        throw new UserError("Invalid User Id", FirebaseErrCode.INVALID_USER_ID);
      }
      throw new Error(`Something went wrong: ${errCode}`);
    }
  }
}
