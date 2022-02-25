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
  plugins: ["@typescript-eslint"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
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
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
      ],
    },
  ],
  rules: {
    quotes: ["error", "double"],
    "no-use-before-define": "off",
    "no-promise-executor-return": "off",
    "implicit-arrow-linebreak": "off",
    "comma-dangle": "off",
    "function-paren-newline": "off",
    "no-else-return": "off",
    "no-console": "off",
    "object-curly-newline": "off",
    "import/extensions": "off",
    "consistent-return": "off",
    "operator-linebreak": "off",
    "no-return-assign": "off",
    indent: "off",
    "class-methods-use-this": "off",
    "max-classes-per-file": "off",
  },
};
