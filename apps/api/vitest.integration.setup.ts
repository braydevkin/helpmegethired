import { inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");
Object.assign(process.env, inject("storageEnvironment"));
