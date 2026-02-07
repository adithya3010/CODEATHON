import type { Express } from "express";
import { ZodError } from "zod";

import { registerInterviewRoutes } from "./routes/interviewRoutes.js";
import { buildContainer } from "../wiring/container.js";
import { InvalidStateError, NotFoundError, ValidationError } from "../domain/errors.js";

export function buildApp(app: Express) {
  const container = buildContainer();

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  registerInterviewRoutes(app, container);

  app.use((err: unknown, _req: any, res: any, _next: any) => {
    // Deterministic error mapping for auditability.
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "invalid_request", details: err.flatten() });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: "validation_error", message: err.message });
    }
    if (err instanceof InvalidStateError) {
      return res.status(409).json({ error: "invalid_state", message: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: "not_found", message: err.message });
    }

    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  });
}
