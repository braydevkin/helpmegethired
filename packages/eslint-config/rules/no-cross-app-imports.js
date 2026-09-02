import path from "node:path";

const PACKAGE_SCOPE = "@helpmegethired/";
const APP_DIRECTORY_SEGMENT = /(?:^|\/)apps\/([^/]+)(?:\/|$)/;

function appOfPath(candidatePath) {
  const match = APP_DIRECTORY_SEGMENT.exec(candidatePath);
  return match ? match[1] : null;
}

function appOfSpecifier(specifier, importerPath, apps) {
  if (specifier.startsWith(".")) {
    return appOfPath(path.resolve(path.dirname(importerPath), specifier));
  }
  if (specifier.startsWith(PACKAGE_SCOPE)) {
    const [packageDirectory] = specifier.slice(PACKAGE_SCOPE.length).split("/");
    return apps.includes(packageDirectory) ? packageDirectory : null;
  }
  return appOfPath(specifier);
}

function sourceOf(node) {
  if (node.type === "CallExpression") {
    const isRequire = node.callee.type === "Identifier" && node.callee.name === "require";
    const [argument] = node.arguments;
    return isRequire && argument?.type === "Literal" ? argument : null;
  }
  return node.source?.type === "Literal" ? node.source : null;
}

export const noCrossAppImports = {
  meta: {
    type: "problem",
    docs: {
      description: "Apps never import from each other; shared code lives in packages/*",
    },
    schema: [
      {
        type: "object",
        properties: {
          apps: { type: "array", items: { type: "string" }, uniqueItems: true },
        },
        required: ["apps"],
        additionalProperties: false,
      },
    ],
    messages: {
      crossApp:
        'App "{{importer}}" cannot import from app "{{target}}". Share code through packages/* instead.',
      appFromPackage:
        'Package code cannot import from app "{{target}}". Dependencies point from apps to packages, never back.',
    },
  },
  create(context) {
    const { apps } = context.options[0];
    const importerApp = appOfPath(context.filename);

    function check(node) {
      const source = sourceOf(node);
      if (!source || typeof source.value !== "string") {
        return;
      }
      const targetApp = appOfSpecifier(source.value, context.filename, apps);
      if (!targetApp || targetApp === importerApp) {
        return;
      }
      context.report({
        node: source,
        messageId: importerApp ? "crossApp" : "appFromPackage",
        data: { importer: importerApp, target: targetApp },
      });
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
