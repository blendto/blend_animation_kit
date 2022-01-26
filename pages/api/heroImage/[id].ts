import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import DynamoDB from "server/external/dynamodb";
import { HeroImage } from "server/base/models/heroImage";

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  try {
    switch (method) {
      case "GET":
        await getHero(req, res);
        break;

      default:
        res.status(404).json({ code: 404, message: "Invalid request" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong!" });
  }
};

const getHero = async (req: NextApiRequest, res: NextApiResponse) => {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: false,
  });

  if (!uid) {
    return;
  }

  const {
    query: { id },
  } = req;

  const heroImage = await _getHero(id as string, uid);
  if (!heroImage) {
    return res
      .status(404)
      .json({ code: 404, message: "No such hero image for user" });
  }
  res.send(heroImage);
};

export const _getHero = async (
  id: String,
  uid: String
): Promise<HeroImage | null> => {
  const heroImage = (await DynamoDB.getItem({
    TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
    Key: { id },
  })) as HeroImage | null;

  if (heroImage == null || heroImage.userId !== uid) {
    return null;
  }
  return heroImage;
};

export const markHeroImageUsage = async (id: String) => {
  const params = {
    UpdateExpression: "SET lastUsedAt = :lastUsedAt",
    ExpressionAttributeValues: {
      ":lastUsedAt": Date.now(),
    },
    Key: { id: id },
    TableName: process.env.HERO_IMAGES_DYNAMODB_TABLE,
    ReturnValues: "NONE",
  };
  await DynamoDB.updateItem(params);
};
