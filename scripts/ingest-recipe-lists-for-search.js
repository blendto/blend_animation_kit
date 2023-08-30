/* eslint-disable no-console */
require("dotenv").config();

const AWS = require("aws-sdk");
const { default: axios } = require("axios");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const httpClient = axios.create({
  baseURL: process.env.RECIPE_SEARCH_BASE_URL,
});

let allFailedIds = [];
ingest(process.env.RECIPE_LIST_DYNAMODB_TABLE);
ingest(process.env.NON_HERO_RECIPE_LIST_DYNAMODB_TABLE);

async function ingest(tableName, exclusiveStartKey = undefined) {
  const params = {
    TableName: tableName,
    ProjectionExpression:
      "id, title, searchTerms, filters, isEnabled, recipes, applicableFor",
  };
  if (exclusiveStartKey) {
    params.ExclusiveStartKey = exclusiveStartKey;
  }
  const scanRes = await dynamodb.scan(params).promise();
  const { LastEvaluatedKey, Count } = scanRes;
  const recipeLists = scanRes.Items.map((r) => ({
    id: `${tableName}/${r.id}`,
    title: r.title,
    searchTerms: r.searchTerms ?? [],
    countryCodes: (r.filters ?? { countryCodes: [] }).countryCodes ?? [],
    isEnabled: r.isEnabled,
    recipes: r.recipes ?? [],
    applicableFor: r.applicableFor ?? [],
  }));
  console.log(`Fetched ${Count} recipe lists`);
  console.log(`lastEvaluatedKey: ${JSON.stringify(LastEvaluatedKey, null, 2)}`);

  if (recipeLists.length) {
    const batchSize = 100;
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
          console.log(
            JSON.stringify({
              msg: `Ingested ${batch.length} recipe lists`,
            })
          );
          if (res.data.err_count > 0) {
            throw new Error(
              `Ingestion partially failed. err_count => ${res.data.err_count}`
            );
          }
        })
        .catch((err) => {
          const failedIds = batch.map((r) => r.id);
          console.warn(
            JSON.stringify({
              msg: `Failed ingesting all or some of recipe lists of following ids: ${failedIds}`,
              reqBody,
              err: {
                message: err.message,
                status: err.response?.status,
                data: err.response?.data,
              },
            })
          );
          allFailedIds = allFailedIds.concat(failedIds);
          // Don't break
        });
      index += batchSize;
    }
  }
  if (LastEvaluatedKey) {
    return await ingest(tableName, LastEvaluatedKey);
  }
  console.log(`Done`);
  if (allFailedIds.length) {
    console.error(
      `Failed ingesting all or some of recipe lists of following ids: ${allFailedIds}`
    );
  }
}
