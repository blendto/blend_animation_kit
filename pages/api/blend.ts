import DynamoDB from "server/external/dynamodb";
import type { NextApiResponse } from "next";
import { Blend } from "server/base/models/blend";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import ConfigProvider from "server/base/ConfigProvider";
import logger from "server/base/Logger";
import { diContainer } from "inversify.config";
import { BlendService } from "server/service/blend";
import { TYPES } from "server/types";
import {
  ensureAuth,
  NextApiRequestExtended,
  withReqHandler,
} from "server/helpers/request";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "GET":
        return ensureAuth(getAllBlends, req, res);
      case "POST":
        return ensureAuth(initBlend, req, res);
      default:
        res.status(405).end();
    }
  }
);

const initBlend = async (req: NextApiRequestExtended, res: NextApiResponse) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  try {
    const blend = await blendService.initBlend(req.uid);
    return res.send(blend);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }
};

const getAllBlends = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  const blendService = diContainer.get<BlendService>(TYPES.BlendService);
  const {
    query: { pageKey },
  } = req;

  let pageKeyObject = null;

  const encodedPageKey = new EncodedPageKey(pageKey);
  if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
    return res.status(400).json({ message: "pageKey should be a string" });
  }
  try {
    pageKeyObject = encodedPageKey.decode();
  } catch (e) {
    return res.status(400).json({ message: "Invalid pageKey format" });
  }

  let items = [];
  let nextPageKey = null;
  try {
    const data = await DynamoDB._().queryItems({
      TableName: ConfigProvider.BLEND_VERSIONED_DYNAMODB_TABLE,
      KeyConditionExpression: "#createdBy = :createdBy",
      IndexName: "createdBy-updatedAt-idx",
      ExpressionAttributeNames: {
        "#createdBy": "createdBy",
        "#status": "status",
        "#output": "output",
        "#version": "version",
      },
      ExpressionAttributeValues: {
        ":createdBy": req.uid,
        ":generated": "GENERATED",
        ":submitted": "SUBMITTED",
        ":currentVersion": "CURRENT",
      },
      ProjectionExpression:
        "id, filePath, imagePath, thumbnail, #output, createdAt, updatedAt, #status",
      FilterExpression:
        "(#version = :currentVersion) AND (#status = :generated OR #status = :submitted)",
      ScanIndexForward: false,
      ExclusiveStartKey: pageKeyObject,
      Limit: 15,
    });

    items = data.Items.map((item) => {
      return blendService.backfillBlendOutput(<Blend>item);
    });

    nextPageKey = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Something went wrong!" });
    return;
  }

  res.send({ data: items, nextPageKey });
};
