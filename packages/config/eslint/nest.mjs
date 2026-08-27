// @ts-check
import tseslint from "typescript-eslint";
import { base } from "./base.mjs";

/** Shared ESLint config for the NestJS API app. */
export default tseslint.config(...base, {
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
  rules: {
    // Decorators (e.g. @Injectable() with no explicit args) trip this rule.
    "@typescript-eslint/no-extraneous-class": "off",
  },
});
