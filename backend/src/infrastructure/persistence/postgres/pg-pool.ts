import { Pool } from "pg";

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: true } : undefined,
});
