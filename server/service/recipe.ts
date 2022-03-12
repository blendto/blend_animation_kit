import "reflect-metadata";
import { IService } from "server/service";
import { inject, injectable } from "inversify";
import DynamoDB from "server/external/dynamodb";
import { TYPES } from "server/types";
import ConfigProvider from "server/base/ConfigProvider";
import { Recipe } from "server/base/models/recipe";

@injectable()
export class RecipeService implements IService {
  @inject(TYPES.DynamoDB) dataStore: DynamoDB;

  async getRecipe(id: string, variant: string = "9:16"): Promise<Recipe> {
    const recipe = await this.dataStore.getItem({
      TableName: ConfigProvider.RECIPE_DYNAMODB_TABLE,
      Key: { id, variant },
    });
    return <Recipe>recipe;
  }
}
