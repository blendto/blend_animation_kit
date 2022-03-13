module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["airbnb-base"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
      ],
      settings: {
        "import/resolver": {
          typescript: {},
        },
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: "./",
      },
      plugins: ["import"],
    },
  ],
  rules: {
    "no-use-before-define": "off",
    "import/extensions": "off",
    "consistent-return": "off",
    quotes: "off",
    "comma-dangle": "off",
  },
};
