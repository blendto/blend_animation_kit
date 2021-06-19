import admin from "firebase-admin";
import { NextApiRequest } from "next";
import ConfigProvider from "server/base/ConfigProvider";
import { UserError } from "server/base/errors";

const FIREBASE_PROJECT_ID = "blend-app-b3f6d";

interface ExtractUserIdFromRequestParams {
  request: NextApiRequest;
  optional?: boolean;
}

class Firebase {
  constructor() {
    if (admin.apps.length != 0) {
      // Already initialized, else causes problems during hot-reloading
      return;
    }
    admin.initializeApp({
      credential: admin.credential.cert(ConfigProvider.FIREBASE_SERVICE_KEY),
    });
  }

  async verifyAndDecodeToken(idToken: string) {
    try {
      let claims = await admin.auth().verifyIdToken(idToken);
      if (claims.aud != FIREBASE_PROJECT_ID) {
        throw new UserError("Invalid Token");
      }
      return claims;
    } catch (e) {
      throw new UserError("Invalid Token");
    }
  }

  async extractUserIdFromRequest({
    request,
    optional,
  }: ExtractUserIdFromRequestParams): Promise<string> {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer")) {
      if (!optional) {
        throw new UserError("No/Invalid auth");
      }
      return null;
    }

    const claims = await this.verifyAndDecodeToken(authHeader.substring(7));

    return claims.uid;
  }
}

export default new Firebase();
