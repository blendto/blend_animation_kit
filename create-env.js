const { assert } = require("console");
const fs = require("fs");

const configValString = process.env["ENV_VARS"];

assert(!!configValString, "ENV_VARS undefined");

const config = JSON.parse(configValString);

let content = "";
for (const property in config) {
  content += `${property}=${config[property]}\n`;
}

fs.writeFileSync("./.env", content);
