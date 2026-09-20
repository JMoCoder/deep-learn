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
  /**
   * Agent book/article generation (boundary → outline → generate_section).
   * Default off for the reading-first phase. Set QUANTUM_GENERATION_ENABLED=1 to unfreeze.
   * Read live so unit tests can toggle process.env without reloading the module.
   */
  get generationEnabled(): boolean {
    return (process.env.QUANTUM_GENERATION_ENABLED ?? "").trim() === "1";
  },
};

mkdirSync(config.dataDir, { recursive: true });
mkdirSync(resolve(config.dataDir, "exports"), { recursive: true });

export const dbPath = resolve(config.dataDir, "quantum.db");
