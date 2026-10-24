import "dotenv/config";
import { mkdirSync } from "node:fs";
import path from "node:path";

async function main() {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url });
    await migrate(drizzle(pool), { migrationsFolder });
    await pool.end();
  } else {
    const dir = process.env.PGLITE_DIR || "./.data/pglite";
    mkdirSync(path.dirname(dir), { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder });
    await client.close();
  }
  console.log("✓ migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
