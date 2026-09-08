import { Controller, Get, Inject, NotFoundException, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { getAbsoluteFSPath } from "swagger-ui-dist";

import { Public } from "../auth/public.decorator";
import { openApiDocument, type OpenApiDocument } from "../openapi/document";
import { DOCS_ENABLED } from "./docs-enabled";

// The only files of Swagger UI the page needs, served from the package the API ships with.
const ASSET_FILES = new Set(["swagger-ui.css", "swagger-ui-bundle.js"]);

// The page loads Swagger UI from the assets the API serves itself, never from a CDN. Nothing
// is interpolated into it.
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Help Me Get Hired API</title>
<link rel="stylesheet" href="/docs/assets/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="/docs/assets/swagger-ui-bundle.js"></script>
<script>
window.ui = SwaggerUIBundle({
  url: "/docs/openapi.json",
  dom_id: "#swagger-ui",
  persistAuthorization: true,
});
</script>
</body>
</html>
`;

// Development only: the same guard answers 404 in production, as every development route does.
@Public()
@Controller("docs")
export class DocsController {
  constructor(@Inject(DOCS_ENABLED) private readonly enabled: boolean) {}

  @Get()
  swaggerUi(@Res() response: Response): void {
    this.assertEnabled();
    response.type("html").send(page);
  }

  @Get("openapi.json")
  document(): OpenApiDocument {
    this.assertEnabled();

    return openApiDocument();
  }

  @Get("assets/:file")
  asset(@Param("file") file: string, @Res() response: Response): void {
    this.assertEnabled();

    if (!ASSET_FILES.has(file)) {
      throw new NotFoundException();
    }

    response.sendFile(file, { root: getAbsoluteFSPath() });
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new NotFoundException();
    }
  }
}
