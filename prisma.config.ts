import "dotenv/config";
import { defineConfig } from "@prisma/config";


const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;


if (!databaseUrl) {
  throw new Error("Neither DATABASE_URL nor MYSQL_URL is defined in the environment.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
  },
});