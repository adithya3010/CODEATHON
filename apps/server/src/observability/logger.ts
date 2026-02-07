import pino from "pino";

export function buildLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: undefined,
    redact: {
      paths: ["req.headers.authorization"],
      remove: true
    }
  });
}
