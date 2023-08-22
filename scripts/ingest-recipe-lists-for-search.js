/* eslint-disable no-console */
require("dotenv").config();

const AWS = require("aws-sdk");
const { default: axios } = require("axios");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.RECIPE_LIST_DYNAMODB_TABLE;
const httpClient = axios.create({
  baseURL: process.env.RECIPE_SEARCH_BASE_URL
});

let allFailedIds = [];
ingest();

async function ingest(exclusiveStartKey = undefined) {
  const params = {
    TableName: tableName,
    ProjectionExpression: "id, title, searchTerms, filters, isEnabled, recipes",
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const scanRes = await dynamodb.scan(params).promise();
  const {
    LastEvaluatedKey,
    Count,
  } = scanRes;
  const recipeLists = scanRes.Items.map((r) => ({
    id: r.id,
    title: r.title,
    searchTerms: r.searchTerms ?? [],
    countryCodes: (r.filters ?? { ccountryCodes: [] }).countryCodes ?? [],
    isEnabled: r.isEnabled,
    recipes: r.recipes
  }));
  console.log(`Fetched ${Count} recipe lists`);
  console.log(`lastEvaluatedKey: ${JSON.stringify(LastEvaluatedKey, null, 2)}`);

  if (recipeLists.length) {
    const batchSize = 10;
    let index = 0;
    while (index < recipeLists.length) {
      const batch = recipeLists.slice(index, index + batchSize);
      if (!batch.length) {
        break;
      }
      const reqBody = { data: batch };
      await httpClient
        .post(`/api/ingest`, reqBody)
        .then((res) => {
          console.log(JSON.stringify({
            msg: `Ingested recipe lists of following ids: ${batch.map((r) => r.id)}`,
            body: res.data
          }));
          if (res.data.err_count > 0) {
            throw new Error(`Ingestion partially failed. err_count => ${res.data.err_count}`);
          }
        })
        .catch((err) => {
          const failedIds = batch.map((r) => r.id);
          console.warn(JSON.stringify({
            msg: `Failed ingesting all or some of recipe lists of following ids: ${failedIds}`,
            reqBody,
            err: {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data,
            }
          }));
          allFailedIds = allFailedIds.concat(failedIds);
          // Don't break
        });
      index += batchSize;
    }
  }
  if (LastEvaluatedKey) {
    return await ingest(LastEvaluatedKey);
  }
  console.log(`Done. Failed ingesting all or some of recipe lists of following ids: ${allFailedIds}`);
}
