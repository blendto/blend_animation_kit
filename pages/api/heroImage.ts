import DynamoDB from "server/external/dynamodb";
import firebase from "server/external/firebase";
import type { NextApiRequest, NextApiResponse } from "next";
import { EncodedPageKey } from "server/helpers/paginationUtils";
import {
  createHeroBucketFileKeys,
  HeroImage,
  HeroImageFileKeys,
} from "server/base/models/heroImage";
import { copyObject, getObject, uploadObject } from "../../server/external/s3";
import ConfigProvider from "../../server/base/ConfigProvider";
import { nanoid } from "nanoid";
import { rescaleImage } from "../../server/helpers/imageUtils";
import {
  bufferToStream,
} from "../../server/helpers/bufferUtils";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  try {
    switch (method) {
      case "GET":
        await getHeroes(req, res);
        break;

      default:
        res.status(404).json({ code: 404, message: "Invalid request" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

async function _createAndSaveThumbnail(
  inputFileKey: string,
  thumbnailFileKey: string
) {
  const bgRemoved: Buffer = await getObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    inputFileKey
  );
  const thumbnail = await rescaleImage(bgRemoved, 240);
  await uploadObject(
    ConfigProvider.HERO_IMAGES_BUCKET,
    thumbnailFileKey,
    bufferToStream(thumbnail)
  );
}

export const createNewHeroImage = async (
  blendId: String,
  userId: String,
  blendBucketFileKeys: HeroImageFileKeys
): Promise<HeroImage> => {
  const heroImageId = nanoid(16);
  const heroBucketFilekeys = createHeroBucketFileKeys(
    heroImageId,
    blendBucketFileKeys
  );

  const copyOriginalFile: Promise<any> = copyObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    blendBucketFileKeys.original,
    ConfigProvider.HERO_IMAGES_BUCKET,
    heroBucketFilekeys.original
  );

  const copyBgRemovedFile: Promise<any> = copyObject(
    ConfigProvider.BLEND_INGREDIENTS_BUCKET,
    blendBucketFileKeys.withoutBg,
    ConfigProvider.HERO_IMAGES_BUCKET,
    heroBucketFilekeys.withoutBg
  );

  const saveThumbnail: Promise<void> = _createAndSaveThumbnail(
    blendBucketFileKeys.withoutBg,
    heroBucketFilekeys.thumbnail
  );

  await Promise.all([copyOriginalFile, copyBgRemovedFile, saveThumbnail]);

  const now = Date.now();

  const heroImage = {
    id: heroImageId,
    original: heroBucketFilekeys.original,
    withoutBg: heroBucketFilekeys.withoutBg,
    thumbnail: heroBucketFilekeys.thumbnail,
    lastUsedAt: now,
    createdAt: now,
    userId: userId,
    sourceBlendId: blendId,
  } as HeroImage;

  await DynamoDB.putItem({
    TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
    Item: heroImage,
  });

  return heroImage;
};

const getHeroes = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  const {
    query: { pageToken },
  } = req;

  let pageKeyObject = null;
  const encodedPageKey = new EncodedPageKey(pageToken);
  if (encodedPageKey.exists() && !encodedPageKey.isValid()) {
    return res.status(400).json({ message: "pageToken should be a string" });
  }
  try {
    pageKeyObject = encodedPageKey.decode();
  } catch (e) {
    return res.status(400).json({ message: "Invalid pageToken format" });
  }

  const data = await DynamoDB.queryItems({
    TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
    KeyConditionExpression: "#userId = :userId",
    IndexName: "userId-lastUsedAt-index",
    ExpressionAttributeNames: {
      "#userId": "userId",
    },
    ExpressionAttributeValues: {
      ":userId": uid,
    },
    ScanIndexForward: false,
    ExclusiveStartKey: pageKeyObject,
    Limit: 20,
  });

  const nextPageToken = EncodedPageKey.fromObject(data.LastEvaluatedKey)?.key;

  const heroImages: HeroImage[] = data.Items.map((entry) => entry as HeroImage);
  res.send({ data: heroImages, nextPageToken });
};
