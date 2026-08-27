// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared base rules for any TypeScript workspace package. */
export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md: never use `any` — unknown types go through `unknown` + zod.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", ".next/**", "node_modules/**", "coverage/**"],
  },
);

export default base;
