// @ts-check
import tseslint from "typescript-eslint";
import { base } from "./base.mjs";

/**
 * Shared ESLint config for the Next.js web app. `next lint` layers Next's own
 * `eslint-config-next` (react/react-hooks/next rules) on top of this via
 * apps/web/eslint.config.mjs — this file only adds our workspace-wide rules.
 */
export default tseslint.config(...base, {
  languageOptions: {
    parserOptions: {
      projectService: true,
    },
  },
});
