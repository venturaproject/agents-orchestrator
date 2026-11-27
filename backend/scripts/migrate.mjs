import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  for (const filename of ["001_initial.sql", "002_agent_results.sql"]) {
    const migration = await readFile(new URL(`../migrations/${filename}`, import.meta.url), "utf8");
    for (let attempt = 1; ; attempt++) {
      try {
        await pool.query(migration);
        break;
      } catch (error) {
        if (attempt >= 20) throw error;
        console.log(`Waiting for PostgreSQL (${attempt}/20)…`);
        await sleep(1000);
      }
    }
  }
  console.log("Database schema is up to date.");
} finally {
  await pool.end();
}
