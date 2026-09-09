import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
process.env.REDIS_URL = inject("redisUrl");
Object.assign(process.env, inject("storageEnvironment"));
