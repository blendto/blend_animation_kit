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
}

export default new ConfigProvider();
