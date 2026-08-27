// @ts-check
import nextConfig from "@job-tracker/config/eslint/next";

export default [
  ...nextConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
