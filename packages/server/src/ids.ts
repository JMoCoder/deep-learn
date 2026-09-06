import { randomUUID } from "node:crypto";

export function id(prefix?: string): string {
  const raw = randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${raw.slice(0, 16)}` : raw;
}
