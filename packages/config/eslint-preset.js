/**
 * @naro/config/eslint-preset
 *
 * ESLint 9 flat config. eslint-config-expo hâlâ legacy formatta olduğu için
 * @eslint/compat ile flat'e çevriliyor. Expo preset zaten import / react /
 * react-hooks / typescript pluginlerini getiriyor — burada tekrar tanımlamak
 * "Cannot redefine plugin" hatası verir. Sadece ortak override'ları ekle.
 */
const { FlatCompat } = require("@eslint/eslintrc");
const { fixupConfigRules } = require("@eslint/compat");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.expo/**",
      "**/dist/**",
      "**/.pnpm-store/**",
      "**/ios/**",
      "**/android/**",
      "**/*.config.js",
      "**/babel.config.js",
      "**/metro.config.js",
      "**/tailwind.config.js",
    ],
  },
  ...fixupConfigRules(compat.extends("eslint-config-expo")),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
        },
      ],
    },
  },
];
