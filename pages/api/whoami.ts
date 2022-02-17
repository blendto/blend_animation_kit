import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import axios from "axios";
import IpApi from "server/external/ipapi";
import { handleServerExceptions } from "server/base/errors";
import { UserAgentDetails } from "../../server/base/models/userAgentDetails";
import { initMiddleware } from "server/helpers/middleware";
import Cors from "cors";

// Initializing the cors middleware
const cors = Cors({
  methods: ["GET", "OPTIONS"],
});

const corsmiddleware = initMiddleware(cors);

export default async (req: NextApiRequest, res: NextApiResponse) => {
  await corsmiddleware(req, res);
  
  const { method } = req;

  switch (method) {
    case "GET":
      await whoami(req, res);
      break;

    default:
      res.status(404).json({ code: 404, message: "Invalid request" });
  }
};

const ipApi = new IpApi();

async function whoami(
  req: NextApiRequest,
  res: NextApiResponse<any>
): Promise<any> {
  const uid = await firebase.extractUserIdFromRequest({
    request: req,
    optional: true,
  });

  const ip = req.headers["x-forwarded-for"] as string;

  if (!ip) {
    return res.status(400).send({ message: "Invalid request" });
  }

  return await handleServerExceptions(res, async () => {
    const ipDetails = await ipApi.getIpInfo(ip);
    return res.send({
      uid,
      details: {
        countryCode: ipDetails["country_code"],
      },
    });
  });
}

export async function getUserAgentDetails(req: NextApiRequest): Promise<UserAgentDetails | null> {
  const ip = req.headers["x-forwarded-for"] as string;
  if (!ip) {
    return null;
  }

  try {
    const ipDetails = await ipApi.getIpInfo(ip);
    return new UserAgentDetails(ipDetails["country_code"]);
  } catch (err) {
    console.error(err);
    return null;
  }
}
