import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // The chassis renders a control's label as `<span><strong>Name</strong><small>hint</small></span>`,
      // which puts the text three levels below the `<label>`. The rule walks two by default and
      // reports a false positive; the accessible name is computed from the whole subtree at any
      // depth. Raising the depth is the option the rule provides for exactly this shape — the
      // alternative was an `aria-label` that replaced the visible text outright, which is a real
      // WCAG 2.5.3 failure traded for a clean lint run.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
    },
  },
]);

export default eslintConfig;
