import { SetMetadata, UseGuards, applyDecorators, type CanActivate, type Type } from "@nestjs/common";

export const ROUTE_CREDENTIAL = "routeCredential";

// A route that also takes a credential other than the Session names the guard that checks it.
// Without a live Session the Session guard hands the request to that guard, which resolves the
// Account or refuses the request, so the marker never exists without its guard.
export const AcceptsRouteCredential = (guard: Type<CanActivate>) => applyDecorators(SetMetadata(ROUTE_CREDENTIAL, true), UseGuards(guard));
