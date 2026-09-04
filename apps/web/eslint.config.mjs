import { base } from "@helpmegethired/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

import { noUpwardStageImports } from "./eslint/no-upward-stage-imports.mjs";

const atomicDesign = {
  files: ["src/components/**"],
  plugins: {
    "atomic-design": { rules: { "no-upward-stage-imports": noUpwardStageImports } },
  },
  rules: {
    "atomic-design/no-upward-stage-imports": "error",
  },
};

export default [...base, nextPlugin.configs["core-web-vitals"], reactHooks.configs.flat.recommended, atomicDesign];
