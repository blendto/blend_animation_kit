import { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import HeroImageService from "server/service/heroImage";

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

  const heroImage = await new HeroImageService().getImage(id as string, uid);
  if (!heroImage) {
    return res
      .status(404)
      .json({ code: 404, message: "No such hero image for user" });
  }
  res.send(heroImage);
};
