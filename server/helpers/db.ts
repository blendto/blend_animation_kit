import { UpdateOperations } from "../repositories";
import AWS from "../external/aws";
import { JsonPatchBody } from "./request";

export enum DynamoOps {
  SET = "SET",
  REMOVE = "REMOVE",
}

type DynamoUpdateBody = Pick<
  AWS.DynamoDB.DocumentClient.UpdateItemInput,
  "UpdateExpression" | "ExpressionAttributeNames" | "ExpressionAttributeValues"
>;

const addDynamoExpr = (
  dynamoParams: DynamoUpdateBody,
  opsList: JsonPatchBody[],
  opName: DynamoOps
): void => {
  if (opsList.length > 0) {
    dynamoParams.UpdateExpression += ` ${opName} `;
    opsList.forEach((patchItem) => {
      const attrName = patchItem.path.slice(1);
      if (opName === DynamoOps.REMOVE) {
        dynamoParams.UpdateExpression += `#${attrName}, `;
      } else {
        dynamoParams.UpdateExpression += `#${attrName} = :${attrName}, `;
        dynamoParams.ExpressionAttributeValues[`:${attrName}`] =
          patchItem.value;
      }
      dynamoParams.ExpressionAttributeNames[`#${attrName}`] = `${attrName}`;
    });
    dynamoParams.UpdateExpression = dynamoParams.UpdateExpression.trim();
    // remove trailing comma
    dynamoParams.UpdateExpression = dynamoParams.UpdateExpression.slice(
      0,
      dynamoParams.UpdateExpression.length - 1
    );
  }
};

export const jsonPatchToDynamoExp = (
  changes: JsonPatchBody[]
): DynamoUpdateBody => {
  const dynamoParams: DynamoUpdateBody = {
    UpdateExpression: "",
    ExpressionAttributeNames: {},
    ExpressionAttributeValues: {},
  };
  const setOps = changes.filter(
    (ch) => ch.op === UpdateOperations.replace || ch.op === UpdateOperations.add
  );
  addDynamoExpr(dynamoParams, setOps, DynamoOps.SET);
  const remOps = changes.filter((ch) => ch.op === UpdateOperations.remove);
  addDynamoExpr(dynamoParams, remOps, DynamoOps.REMOVE);
  return dynamoParams;
};
