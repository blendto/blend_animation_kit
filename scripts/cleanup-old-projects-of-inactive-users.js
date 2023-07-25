/* eslint-disable no-await-in-loop */
require("dotenv").config();

const AWS = require("aws-sdk");
const { default: axios } = require("axios");

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = "BLENDS";

const nowTs = Date.now();
const sixMonthsTs = 1000 * 60 * 60 * 24 * 180;

const httpClient = axios.create({
  baseURL: "https://blendnow.com/api"
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
execute();

async function execute() {
    const executedUsers = new Set();
    let exclusiveStartKey;
    do {
        const listUserIdsRes = await listUserIds(exclusiveStartKey);
        const { userIds } = listUserIdsRes;
        ({ exclusiveStartKey } = listUserIdsRes);
        for (const userId of userIds) {
            if (!executedUsers.has(userId)) {
                if (await hasUserBeenInactive(userId)) {
                    console.log("Found user as inactive. Sending request to cleanup old projects");
                    await httpClient.post('temp/cleanup-inactive-user-old-projects', { userId });
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }
                executedUsers.add(userId);
            }
        }
    } while (exclusiveStartKey);
}

async function listUserIds(exclusiveStartKey) {
    const params = {
        TableName: tableName,
        IndexName: "createdBy-updatedAt-idx",
        ProjectionExpression: 'createdBy'
    };
    if (exclusiveStartKey) {
      params.ExclusiveStartKey = exclusiveStartKey;
    }
    const res = await dynamodb.scan(params).promise();
    return {
        userIds: res.Items.map((i) => i.createdBy),
        exclusiveStartKey: res.LastEvaluatedKey
    };
}

async function hasUserBeenInactive(userId) {
    const params = {
        TableName: tableName,
        IndexName: "createdBy-updatedAt-idx",
        KeyConditionExpression: "#createdBy = :createdBy",
        ExpressionAttributeNames: {
            "#createdBy": "createdBy"
        },
        ExpressionAttributeValues: {
            ":createdBy": userId
        },
        ProjectionExpression: 'updatedAt',
        ScanIndexForward: false,
        Limit: 1,
    };
    const res = await dynamodb.query(params).promise();
    if (res.Items[0]) {
        const timeSinceLastUpdationByUserInTs = nowTs - res.Items[0].updatedAt;
        console.log({ userId, timeSinceLastUpdationByUserInTs });
        return timeSinceLastUpdationByUserInTs > sixMonthsTs;
    }
    return false;
}
