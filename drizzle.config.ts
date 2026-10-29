import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/persistence/schema.ts",
  out: "./src/infrastructure/persistence/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://tracking:tracking@localhost:5432/tracking",
    ssl: process.env.DATABASE_SSL === "true",
  },
});
