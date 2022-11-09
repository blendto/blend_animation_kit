import { UpdateOperations } from "../repositories";
import { jsonPatchToDynamoExp } from "./db";
import { JsonPatchBody } from "./request";

describe("jsonPatchToDynamoExp", () => {
  it("converts JSON patch to dynamo body", () => {
    const jsonPatch: JsonPatchBody[] = [
      {
        path: "/fileName",
        op: UpdateOperations.add,
        value: "newName",
      },
      {
        path: "/title",
        op: UpdateOperations.replace,
        value: "newTitle",
      },
      {
        path: "/bg",
        op: UpdateOperations.remove,
      },
    ];
    const dynamoBody = jsonPatchToDynamoExp(jsonPatch);
    expect(dynamoBody).toMatchObject({
      UpdateExpression: "SET #fileName = :fileName, #title = :title REMOVE #bg",
      ExpressionAttributeNames: {
        "#fileName": "fileName",
        "#title": "title",
        "#bg": "bg",
      },
      ExpressionAttributeValues: {
        ":fileName": "newName",
        ":title": "newTitle",
      },
    });
  });
});
