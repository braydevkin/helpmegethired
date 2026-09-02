import { base } from "@helpmegethired/eslint-config";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default [...base, nextPlugin.configs["core-web-vitals"], reactHooks.configs.flat.recommended];
