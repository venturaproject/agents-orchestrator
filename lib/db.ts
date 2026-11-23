import { Pool } from "pg";

const globalForPg = globalThis as unknown as { crewPgPool?: Pool };

export const db = globalForPg.crewPgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined,
});

if (process.env.NODE_ENV !== "production") globalForPg.crewPgPool = db;
