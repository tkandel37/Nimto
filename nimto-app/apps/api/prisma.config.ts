import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

const envPath = ".env";

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    if (process.env[key]) {
      continue;
    }

    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "ts-node prisma/seed.ts",
  },
});
