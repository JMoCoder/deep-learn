const SECRET = /api[_-]?key|authorization|token|secret|password|bearer/i;

export function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return SECRET.test(value) ? "[redacted]" : value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET.test(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export function safeLog(label: string, value?: unknown): void {
  if (value === undefined) {
    console.log(label);
    return;
  }
  console.log(label, JSON.stringify(redact(value)));
}
