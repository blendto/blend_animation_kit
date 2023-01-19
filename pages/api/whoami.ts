import type { NextApiResponse } from "next";
import IpApi from "server/external/ipapi";
import { UserAgentDetails } from "server/base/models/userAgentDetails";
import { initMiddleware } from "server/helpers/middleware";
import Cors from "cors";
import logger from "server/base/Logger";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";

// Initializing the cors middleware
const cors = Cors({
  methods: ["GET", "OPTIONS"],
});

const corsMiddleware = initMiddleware(cors);

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    await corsMiddleware(req, res);
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
  req: NextApiRequestExtended,
  res: NextApiResponse<any>
): Promise<any> {
  const { ip } = req;

  if (!ip) {
    return res.status(400).send({ message: "Invalid request" });
  }

  const ipDetails = await ipApi.getIpInfo(ip);
  return res.send({
    uid: req.uid,
    details: {
      countryCode: ipDetails.country_code,
    },
  });
}

export async function getUserAgentDetails(
  req: NextApiRequestExtended
): Promise<UserAgentDetails | null> {
  const { ip } = req;
  if (!ip) {
    return null;
  }

  try {
    const ipDetails = await ipApi.getIpInfo(ip);
    return new UserAgentDetails(ipDetails.country_code);
  } catch (err) {
    logger.error(err);
    return null;
  }
}
