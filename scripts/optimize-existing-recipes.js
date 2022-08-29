/* eslint-disable no-console */
require("dotenv").config();

const AWS = require("aws-sdk");
const { default: axios } = require("axios");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.RECIPE_DYNAMODB_TABLE;

const httpClient = axios.create({
  baseURL: "https://blend.to/",
  headers: {
    "X-API-Token": "REPLACE-WITH-THE-TOKEN",
  },
});
optimize();

async function optimize(exclusiveStartKey = undefined) {
  const params = {
    TableName: tableName,
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const {
    Items: recipes,
    LastEvaluatedKey,
    Count,
  } = await dynamodb.scan(params).promise();
  console.log(`Fetched ${Count} recipes`);
  console.log(`lastEvaluatedKey: ${JSON.stringify(LastEvaluatedKey, null, 2)}`);

  const promiseSets = [[]];
  const failedOnes = [];
  // eslint-disable-next-line no-restricted-syntax
  recipes.forEach((r) => {
    if (promiseSets[promiseSets.length - 1] >= 5) {
      promiseSets.push([]);
    }
    promiseSets[promiseSets.length - 1].push(
      httpClient
        .post(`api/recipe/${r.id}/optimize`, {
          variant: r.variant,
        })
        .catch((err) => {
          const details = {
            message: err.message,
            status: err.response?.status,
            data: err.response?.data,
          };
          failedOnes.push({ id: r.id, variant: r.variant, details });
          // Don't break
        })
        .finally(() => {
          console.log(`Processed recipe ${r.id}/${r.variant}`);
        })
    );
  });
  // eslint-disable-next-line no-restricted-syntax
  for (const p of promiseSets) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(p);
  }
  console.log(`Failed ones: ${JSON.stringify(failedOnes, null, 2)}`);

  if (LastEvaluatedKey) {
    return await optimize(LastEvaluatedKey);
  }
  console.log("Done");
}
