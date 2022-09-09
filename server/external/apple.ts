import axios from "axios";
import { injectable } from "inversify";
import Jwt from "jsonwebtoken";
import QueryString from "qs";
import ConfigProvider from "server/base/ConfigProvider";
import { handleInternalAxiosCall } from "server/helpers/network";

@injectable()
export default class AppleService {
  private generateJWT() {
    return Jwt.sign(
      {
        iss: ConfigProvider.APPLE_TEAM_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 120,
        aud: "https://appleid.apple.com",
        sub: ConfigProvider.APPLE_APP_ID,
      },
      ConfigProvider.APPLE_AUTH_KEY,
      {
        algorithm: "ES256",
        header: {
          alg: "ES256",
          kid: ConfigProvider.APPLE_KEY_ID,
        },
      }
    );
  }

  async getOfflineToken(authCode: string) {
    const data = {
      code: authCode,
      client_id: ConfigProvider.APPLE_APP_ID,
      client_secret: this.generateJWT(),
      grant_type: "authorization_code",
    };

    const resBody = (
      await handleInternalAxiosCall<Record<string, unknown>>(
        async () =>
          await axios.post(
            `https://appleid.apple.com/auth/token`,
            QueryString.stringify(data),
            {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          )
      )
    ).data;
    return resBody.refresh_token;
  }

  async revokeToken(offlineToken: string) {
    const data = {
      token: offlineToken,
      client_id: ConfigProvider.APPLE_APP_ID,
      client_secret: this.generateJWT(),
      token_type_hint: "refresh_token",
    };
    await handleInternalAxiosCall<Record<string, unknown>>(
      async () =>
        await axios.post(
          `https://appleid.apple.com/auth/revoke`,
          QueryString.stringify(data),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        )
    );
  }
}
