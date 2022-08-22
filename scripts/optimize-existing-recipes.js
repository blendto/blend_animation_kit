/* eslint-disable no-console */
require("dotenv").config();

const AWS = require("aws-sdk");
const { default: axios } = require("axios");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.RECIPE_DYNAMODB_TABLE;

(async () => {
  const recipes = await getAllRecipes();
  console.log(`Fetched ${recipes.length} recipes in total`);
  const httpClient = axios.create({
    baseURL: "REPLACE-WITH-BASE-PATH",
    headers: {
      "X-API-Token": "REPLACE-WITH-THE-TOKEN",
    },
  });
  const failedOnes = [];
  recipes.forEach(async (r, index) => {
    try {
      const res = await httpClient.post(`api/recipe/${r.id}/optimize`, {
        variant: r.variant,
      });
      console.log(`Optimized ${r.id}/${r.variant}. res: `, res.data);
    } catch (err) {
      failedOnes.push({ id: r.id, variant: r.variant });
      // Don't break
    }
    if (index === recipes.length - 1) {
      console.log("Done");
      console.log("Failed ones: ", failedOnes);
    }
  });
})();

async function getAllRecipes(recipes = [], exclusiveStartKey = undefined) {
  const params = {
    TableName: tableName,
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const res = await dynamodb.scan(params).promise();
  recipes = recipes.concat(res.Items);
  console.log(`Fetched ${res.Count} recipes`);
  if (res.LastEvaluatedKey) {
    return await getAllRecipes(recipes, res.LastEvaluatedKey);
  }
  return recipes;
}
