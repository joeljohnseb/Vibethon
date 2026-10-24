import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import * as schema from "./schema";

export type Schema = typeof schema;
export type DB = PgDatabase<PgQueryResultHKT, Schema>;
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Either the root db or an open transaction. */
export type Executor = DB | Tx;

type Holder = { db?: DB; close?: () => Promise<void> };
const g = globalThis as unknown as { __eberDb?: Holder };
const holder: Holder = (g.__eberDb ??= {});

/** Local data directory for the embedded Postgres used in development. */
export const PGLITE_DIR = process.env.PGLITE_DIR || "./.data/pglite";

function init(): DB {
  if (holder.db) return holder.db;
  const url = process.env.DATABASE_URL;
  if (url) {
    // Production / shared Postgres.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX || 10) });
    holder.db = drizzle(pool, { schema }) as unknown as DB;
    holder.close = () => pool.end();
  } else {
    // Zero-setup embedded Postgres (PGlite) for local development.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const client = new PGlite(PGLITE_DIR);
    holder.db = drizzle(client, { schema }) as unknown as DB;
    holder.close = () => client.close();
  }
  return holder.db;
}

/** Lazily-initialised database handle (no connection is opened at import/build time). */
export const db: DB = new Proxy({} as DB, {
  get(_t, prop) {
    const real = init() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

/** Test hook: swap the database (e.g. an in-memory PGlite). */
export function __setDb(next: DB, close?: () => Promise<void>) {
  holder.db = next;
  holder.close = close;
}

export async function closeDb() {
  await holder.close?.();
  holder.db = undefined;
  holder.close = undefined;
}

export { schema };
