import { NextApiRequest, NextApiResponse } from "next";
import RecoEngineApi from "../../server/internal/reco-engine";
import { initMiddleware } from "server/helpers/middleware";
import Cors from "cors";
import { passthrough } from "server/helpers/network";

// Initializing the cors middleware
const cors = Cors({
  methods: ["POST", "OPTIONS"],
});

const corsmiddleware = initMiddleware(cors);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await corsmiddleware(req, res);

  const { method } = req;

  switch (method) {
    case "POST":
      await identifyProduct(req, res);
      break;
    default:
      res.status(404).json({ code: 404, message: "Not Found!" });
  }
};

const identifyProduct = async (req: NextApiRequest, res: NextApiResponse) => {
  await passthrough(req, res, new RecoEngineApi().identifyProduct);
};
