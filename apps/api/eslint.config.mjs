// @ts-check
import nestConfig from "@job-tracker/config/eslint/nest";

export default [
  ...nestConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
