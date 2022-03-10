const AWS = require("aws-sdk");

// This is a custon env vars required in vercel environment. In other places
// it will be configured via other sources (like service/machine IAM role)
export const getCredentials = () => {
  if (
    process.env.AWS_CLOUD_ACCESS_KEY_ID &&
    process.env.AWS_CLOUD_SECRET_ACCESS_KEY
  ) {
    return {
      accessKeyId: process.env.AWS_CLOUD_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_CLOUD_SECRET_ACCESS_KEY,
    };
  }

  return null;
};

AWS.config.update({
  credentials: getCredentials(),
  region: process.env.AWS_CLOUD_REGION,
});

export default AWS;
