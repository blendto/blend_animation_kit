const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.AWS_CLOUD_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_CLOUD_SECRET_ACCESS_KEY,
  region: process.env.AWS_CLOUD_REGION,
});

export default AWS;
