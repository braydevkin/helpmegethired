import js from "@eslint/js";
import tseslint from "typescript-eslint";

import { noCrossAppImports } from "./rules/no-cross-app-imports.js";

export const applications = ["web", "api"];

const buildOutputs = {
  ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/node_modules/**"],
};

const monorepoBoundaries = {
  plugins: {
    helpmegethired: {
      rules: { "no-cross-app-imports": noCrossAppImports },
    },
  },
  rules: {
    "helpmegethired/no-cross-app-imports": ["error", { apps: applications }],
  },
};

export const base = tseslint.config(
  buildOutputs,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  monorepoBoundaries,
);

export default base;
