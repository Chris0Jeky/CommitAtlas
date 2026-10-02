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
    // Generated, hash-locked Pulseboard SDK artifact; `observatory/check.mjs` verifies it instead.
    "public/pulseboard.js",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    files: ["packages/svg/src/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error",
        ...[["Date", "now"], ["Math", "random"], ["crypto", "randomUUID"]].flatMap(([owner, member]) => [
          { selector: `MemberExpression[object.name='${owner}'][property.name='${member}'], MemberExpression[object.name='${owner}'][property.value='${member}']`, message: "SVG output must use snapshot time or seeded randomness." },
          ...["name", "value"].flatMap(ownerKey => ["name", "value"].map(memberKey => ({ selector: `MemberExpression[object.object.name=/^(globalThis|window|self)$/][object.property.${ownerKey}='${owner}'][property.${memberKey}='${member}']`, message: "SVG output must use snapshot time or seeded randomness." }))),
        ]),
        { selector: "NewExpression[callee.name='Date'][arguments.length=0], NewExpression[callee.object.name=/^(globalThis|window|self)$/][callee.property.name='Date'][arguments.length=0], NewExpression[callee.object.name=/^(globalThis|window|self)$/][callee.property.value='Date'][arguments.length=0]", message: "SVG dates must have an explicit snapshot-derived argument." },
        { selector: "CallExpression[callee.name='Date'], CallExpression[callee.object.name=/^(globalThis|window|self)$/][callee.property.name='Date'], CallExpression[callee.object.name=/^(globalThis|window|self)$/][callee.property.value='Date']", message: "Calling Date without new reads the process clock." },
        { selector: "ImportSpecifier[imported.name='randomUUID']", message: "SVG output must use a deterministic namespace." },
      ],
    },
  },
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
