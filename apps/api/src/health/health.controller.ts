import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@helpmegethired/shared";

import { Public } from "../auth/public.decorator";
import { HealthService } from "./health.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }
}
