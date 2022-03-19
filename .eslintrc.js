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
      rules: { "@typescript-eslint/no-empty-interface": "off" },
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
    {
      files: ["*.test.ts", "*.test.tsx"],
      rules: {
        "@typescript-eslint/no-misused-promises": "off",
      },
    },
  ],
  rules: {
    "no-use-before-define": "off",
    "import/extensions": "off",
    "consistent-return": "off",
    quotes: "off",
    "comma-dangle": "off",
    "no-shadow": "off",
    "lines-between-class-members": "off",
    "max-classes-per-file": "off",
    "no-return-await": "off",
    "object-curly-newline": "off",
    "implicit-arrow-linebreak": "off",
    "operator-linebreak": "off",
    "function-paren-newline": "off",
    "prefer-template": "off",
    "no-constant-condition": "off",
    "import/prefer-default-export": "off",
    indent: "off",
    "brace-style": "off",
    "class-methods-use-this": "off",
  },
};
