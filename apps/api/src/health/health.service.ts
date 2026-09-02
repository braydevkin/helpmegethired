import { Injectable } from "@nestjs/common";
import type { HealthStatus } from "@helpmegethired/shared";

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }
}
