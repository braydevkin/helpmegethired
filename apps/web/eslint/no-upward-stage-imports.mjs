import path from "node:path";

const STAGES = ["atoms", "molecules", "organisms", "templates"];
const COMPONENT_PATH = /(?:^|\/)src\/components\/(atoms|molecules|organisms|templates)\/([^/]+)(?:\/|$)/;
const PAGE_PATH = /(?:^|\/)src\/app(?:\/|$)/;

function placeOf(filePath) {
  const match = COMPONENT_PATH.exec(filePath);
  return match ? { stage: match[1], component: match[2] } : null;
}

function sourceOf(node) {
  if (node.type === "CallExpression") {
    const isRequire = node.callee.type === "Identifier" && node.callee.name === "require";
    const [argument] = node.arguments;
    return isRequire && argument?.type === "Literal" ? argument : null;
  }
  return node.source?.type === "Literal" ? node.source : null;
}

const singular = (stage) => stage.slice(0, -1);

// A relative specifier is resolved against the importing file; any other specifier
// (a package path, an alias) is checked as written, so a component cannot reach a
// higher stage by spelling the path out from the package root.
function targetOf(specifier, filename) {
  return specifier.startsWith(".") ? path.resolve(path.dirname(filename), specifier) : specifier;
}

export const noUpwardStageImports = {
  meta: {
    type: "problem",
    docs: {
      description: "Atomic design stages import only from the stages below them, never up or sideways",
    },
    schema: [],
    messages: {
      upward:
        'A {{importer}} cannot import from the {{target}} stage. Imports only go down: atoms, molecules, organisms, templates.',
      sameStage:
        "A {{importer}} cannot import another {{importer}}. Compose it from the stages below instead.",
      page: "A {{importer}} cannot import from src/app. Pages pass what a component needs as props.",
    },
  },
  create(context) {
    const importer = placeOf(context.filename);
    if (!importer) {
      return {};
    }

    function check(node) {
      const source = sourceOf(node);
      if (!source || typeof source.value !== "string") {
        return;
      }
      const targetPath = targetOf(source.value, context.filename);
      const data = { importer: singular(importer.stage) };

      if (PAGE_PATH.test(targetPath)) {
        context.report({ node: source, messageId: "page", data });
        return;
      }

      const target = placeOf(targetPath);
      if (!target || (target.stage === importer.stage && target.component === importer.component)) {
        return;
      }
      if (target.stage === importer.stage) {
        context.report({ node: source, messageId: "sameStage", data });
        return;
      }
      if (STAGES.indexOf(target.stage) > STAGES.indexOf(importer.stage)) {
        context.report({ node: source, messageId: "upward", data: { ...data, target: target.stage } });
      }
    }

    return {
      ImportDeclaration: check,
      ImportExpression: check,
      ExportAllDeclaration: check,
      ExportNamedDeclaration: check,
      CallExpression: check,
    };
  },
};
