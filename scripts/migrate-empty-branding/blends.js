/* eslint-disable no-await-in-loop */
require("dotenv").config();
const AWS = require("aws-sdk");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.BLEND_DYNAMODB_TABLE;
const DAY_B4_UPDATE = new Date("2022-03-24");
const DAY_AFTER_UPDATE = new Date("2022-04-13");

// eslint-disable-next-line @typescript-eslint/no-floating-promises
updateMatching();

async function updateMatching() {
  const datePointer = DAY_B4_UPDATE;
  while (datePointer < DAY_AFTER_UPDATE) {
    await updateBlendsCreatedOn(datePointer.toISOString().slice(0, 10));
    datePointer.setDate(datePointer.getDate() + 1);
  }
}

async function updateBlendsCreatedOn(createdOn) {
  console.info("\n///////////////////////////////////////");
  console.info("Date: ", createdOn);
  let exclusiveStartKey;
  do {
    const params = {
      TableName: tableName,
      IndexName: "created-on-idx",
      KeyConditionExpression: "#createdOn = :createdOn",
      FilterExpression: "#branding = :branding",
      ExpressionAttributeNames: {
        "#createdOn": "createdOn",
        "#branding": "branding",
      },
      ExpressionAttributeValues: {
        ":createdOn": createdOn,
        ":branding": {},
      },
    };
    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }
    const res = await dynamodb.query(params).promise();
    const blends = res.Items;
    console.log(
      `Fetched ${res.Count} blends of following ids: `,
      blends.map((i) => i.id)
    );
    await executeBatchWrite(blends);
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
