import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: "./.data/pglite" } }),
});
