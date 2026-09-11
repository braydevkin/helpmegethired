import type { CorsOptions, CorsOptionsDelegate } from "@nestjs/common/interfaces/external/cors-options.interface";
import type { Request } from "express";

// The web app calls the API from its server side, so the browser needs CORS for one route
// only: sending the Model Key straight to the API with a Model Key ticket (ADR-0023).
const BROWSER_ROUTE = "/account/model";

const browserRouteOptions = (webOrigin: string): CorsOptions => ({
  origin: webOrigin,
  methods: ["PUT"],
  allowedHeaders: ["Authorization", "Content-Type"],
  credentials: false,
  maxAge: 600,
});

const pathOf = (url: string | undefined): string => (url ?? "").split("?")[0] ?? "";

export const corsOptionsFor =
  (webOrigin: string): CorsOptionsDelegate<Request> =>
  (request, callback) => {
    callback(null, pathOf(request.url) === BROWSER_ROUTE ? browserRouteOptions(webOrigin) : { origin: false });
  };
