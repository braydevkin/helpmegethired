import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@helpmegethired/shared";

import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthStatus {
    return this.healthService.check();
  }
}
