import { NextApiRequest, NextApiResponse } from "next";

// Helper method to wait for a middleware to execute before continuing
// And to throw an error when an error happens in a middleware
// eslint-disable-next-line import/prefer-default-export, @typescript-eslint/ban-types
export function initMiddleware(middleware: Function) {
  return (req: NextApiRequest, res: NextApiResponse) =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      middleware(req, res, (result: any) => {
        if (result instanceof Error) {
          return reject(result);
        }
        return resolve(result);
      });
    });
}
