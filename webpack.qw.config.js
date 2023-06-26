/* eslint-disable import/no-extraneous-dependencies */
const path = require("path");
// const nodeExternals = require("webpack-node-externals");
const glob = require("glob");
const TerserPlugin = require("terser-webpack-plugin");

const { NODE_ENV = "production" } = process.env;
function getEntries(pattern) {
  const entries = {};
  glob.sync(pattern).forEach((file) => {
    const outputFileKey = path.basename(file);
    entries[outputFileKey] = path.join(__dirname, file);
  });

  return entries;
}

module.exports = {
  entry: getEntries("./functions/**/*.ts"),
  mode: NODE_ENV,
  target: "node",
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "[name]/index.js",
  },
  resolve: {
    extensions: [".ts", ".js"],
    modules: [path.resolve(__dirname), "node_modules"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: { noEmit: false },
              configFile: "tsconfig.webpack.json",
            },
          },
        ],
      },
    ],
  },
  externals: [
    {
      sharp: "commonjs sharp",
    },
    // Issue with dd-trace requirements. ref:  https://github.com/DataDog/dd-trace-js/issues/827
    "graphql/language/visitor",
    "graphql/language/printer",
    "graphql/utilities",
    // End of issue
  ],
};
