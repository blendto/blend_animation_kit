const https = require("https");

module.exports.getSecrets = async () =>
  new Promise((resolve, reject) => {
    https
      .get(
        `https://${process.env.DOPPLER_TOKEN}@api.doppler.com/v3/configs/config/secrets/download?format=json`,
        (res) => {
          if (res.statusCode !== 200) {
            reject();
          }
          let secrets = "";
          res.on("data", (data) => (secrets += data));
          res.on("end", () => resolve(JSON.parse(secrets)));
        }
      )
      .on("error", (e) => reject(e));
  });
