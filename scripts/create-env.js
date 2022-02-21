const { assert } = require("console");
const fs = require("fs");
const { getSecrets } = require("./doppler-secrets");
const {
  EnvironmentVarsSchema,
} = require("../server/base/EnvironmentVarsSchema");

(async () => {
  const configValString = process.env["ENV_VARS"];

  let envVars = configValString ? JSON.parse(configValString) : null;

  if (!envVars) {
    envVars = await getSecrets();
    if (!envVars.DOPPLER_PROJECT) {
      throw new Error("Fetching failed from doppler: " + envVars.messages);
    }
  }

  if (!envVars) {
    throw new Error("ENV_VARS undefined/doppler secrets empty");
  }

  const result = EnvironmentVarsSchema.validate(envVars);

  if (result.error) {
    throw new Error(result.error.message);
  }

  let content = "";
  for (const property in envVars) {
    content += `${property}=${envVars[property]}\n`;
  }

  fs.writeFileSync("./.env", content);
})();
