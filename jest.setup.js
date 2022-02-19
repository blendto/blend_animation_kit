// Env vars for the tests
// If the value doesn't matter, just add the env name to the below array
// Else set process.env[varName] = value below the `forEach` block
["BLEND_INGREDIENTS_BUCKET", "HERO_IMAGES_BUCKET"].forEach((envVar) => {
  process.env[envVar] = "whatever";
});
