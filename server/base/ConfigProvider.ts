import { convertLegacyProps } from "antd/lib/button/button";
import { parse } from "node:path";

class ConfigProvider {
  private retrieveOrCrash(envVar: string): string {
    const variable = process.env[envVar];
    if (!variable || variable.trim().length == 0) {
      throw new Error(`envVar ${envVar} not set!`);
    }
    return variable;
  }

  public get BLEND_INGREDIENTS_BUCKET() {
    return this.retrieveOrCrash("BLEND_INGREDIENTS_BUCKET");
  }

  public get RECIPE_INGREDIENTS_BUCKET() {
    return this.retrieveOrCrash("RECIPE_INGREDIENTS_BUCKET");
  }

  public get WEB_USER_ASSETS_BUCKET() {
    return this.retrieveOrCrash("WEB_USER_ASSETS_BUCKET");
  }

  public get OUTPUT_BASE_PATH() {
    // WIERD ISSUE COVER UP.
    // If we do this.retriveOrCrash("NEXT_PUBLIC_OUTPUT_BASE_PATH"), it throws error coz process.env does not have it
    // If we log process.env here it prints {}, which validates the above.
    // But if we do process.env.NEXT_PUBLIC_OUTPUT_BASE_PATH or even process.env["NEXT_PUBLIC_OUTPUT_BASE_PATH"] it works
    // WTF! Leaving it as is for now.
    return process.env.NEXT_PUBLIC_OUTPUT_BASE_PATH;
  }

  public get TOOLKIT_BASE_PATH() {
    return this.retrieveOrCrash("TOOLKIT_BASE_PATH");
  }

  public get VES_API_BASE_PATH() {
    return this.retrieveOrCrash("VES_API_BASE_PATH");
  }

  public get RECO_API_BASE_PATH() {
    return this.retrieveOrCrash("RECO_ENGINE_BASE_URL");
  }

  public get FIREBASE_SERVICE_KEY() {
    let parsedKey = JSON.parse(this.retrieveOrCrash("FIREBASE_SERVICE_KEY"));
    parsedKey = {
      ...parsedKey,
      private_key: parsedKey["private_key"].replace(/\\n/g, "\n"),
    };
    return parsedKey;
  }

  public get IPAPI_ACCESS_KEY() {
    return this.retrieveOrCrash("IPAPI_ACCESS_KEY");
  }
}

export default new ConfigProvider();
