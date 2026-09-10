import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

function env(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  host: env("QUANTUM_HOST", "127.0.0.1"),
  port: Number(env("QUANTUM_PORT", "43128")),
  dataDir: resolve(env("QUANTUM_DATA_DIR", "./data")),
  /** Empty = no HTTP gate (local unit tests). Compose sets a preview default. */
  apiToken: env("QUANTUM_API_TOKEN", ""),
};

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(resolve(config.dataDir, "exports"), { recursive: true });

export const dbPath = resolve(config.dataDir, "quantum.db");
