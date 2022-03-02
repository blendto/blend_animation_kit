import type { NextApiRequest, NextApiResponse } from "next";
import firebase from "server/external/firebase";
import IpApi from "server/external/ipapi";
import { UserAgentDetails } from "../../server/base/models/userAgentDetails";
import { initMiddleware } from "server/helpers/middleware";
import Cors from "cors";
import logger from "server/base/Logger";
import withErrorHandler from "request-handler";

// Initializing the cors middleware
const cors = Cors({
  methods: ["GET", "OPTIONS"],
});

const corsmiddleware = initMiddleware(cors);

export default withErrorHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    await corsmiddleware(req, res);
    const { method } = req;
    switch (method) {
      case "GET":
        return whoami(req, res);
      default:
        res.status(405).end();
    }
  }
);

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

  const ipDetails = await ipApi.getIpInfo(ip);
  return res.send({
    uid,
    details: {
      countryCode: ipDetails["country_code"],
    },
  });
}

export async function getUserAgentDetails(
  req: NextApiRequest
): Promise<UserAgentDetails | null> {
  const ip = req.headers["x-forwarded-for"] as string;
  if (!ip) {
    return null;
  }

  try {
    const ipDetails = await ipApi.getIpInfo(ip);
    return new UserAgentDetails(ipDetails["country_code"]);
  } catch (err) {
    logger.error(err);
    return null;
  }
}
