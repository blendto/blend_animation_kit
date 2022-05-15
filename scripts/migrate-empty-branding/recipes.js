/* eslint-disable no-await-in-loop */
require("dotenv").config();
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.RECIPE_DYNAMODB_TABLE;

// eslint-disable-next-line @typescript-eslint/no-floating-promises
updateMatching();

async function updateMatching() {
  console.info("\n///////////////////////////////////////");
  let exclusiveStartKey;
  do {
    const params = {
      TableName: tableName,
      FilterExpression: "#branding = :branding",
      ExpressionAttributeNames: {
        "#branding": "branding",
      },
      ExpressionAttributeValues: {
        ":branding": {},
      },
    };
    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }
    const res = await dynamodb.scan(params).promise();
    const recipes = res.Items;
    console.log(
      `Fetched ${res.Count} recipes of following ids: `,
      recipes.map((i) => i.id)
    );
    await executeBatchWrite(recipes);
    exclusiveStartKey = res.LastEvaluatedKey;
  } while (exclusiveStartKey);
}

async function executeBatchWrite(items) {
  while (items.length) {
    const now = Date.now();
    const subItems = items.splice(0, 25);
    await dynamodb
      .batchWrite({
        RequestItems: {
          [tableName]: subItems.map((i) => ({
            PutRequest: {
              Item: {
                ...i,
                branding: null,
                updatedAt: now,
              },
            },
          })),
        },
      })
      .promise();
    console.log(
      `Updated ${subItems.length} items of following ids: `,
      subItems.map((i) => i.id)
    );
  }
}
