// @ts-check
import tseslint from "typescript-eslint";
import { base } from "./base.mjs";

/**
 * Shared ESLint config for the Next.js web app. Day 1-2 keeps this to our
 * own workspace-wide rules only (no `eslint-config-next` / react-hooks
 * plugin yet — CLAUDE.md says ask before adding a library, and there's no
 * real interactive UI yet to need those rules for). Add it when Day 3-4's
 * client components land.
 */
export default tseslint.config(...base, {
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
});
