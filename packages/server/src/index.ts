import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { safeLog } from "./redact.js";

const { app } = createApp();

serve({ fetch: app.fetch, hostname: config.host, port: config.port }, (info) => {
  safeLog(`quantum server http://${info.address}:${info.port}`);
});
