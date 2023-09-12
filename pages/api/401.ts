import { MethodNotAllowedError } from "server/base/errors";
import { NextApiRequestExtended, withReqHandler } from "server/helpers/request";
import UnauthorizedError from "server/base/errors/UnauthorizedError";

export default withReqHandler((req: NextApiRequestExtended) => {
  const { method } = req;
  switch (method) {
    case "POST":
      uploadImage();
      break;
    default:
      throw new MethodNotAllowedError();
  }
});

const uploadImage = () => {
  throw new UnauthorizedError("Force throw");
};
