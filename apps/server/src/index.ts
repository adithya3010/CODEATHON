import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";

import { buildLogger } from "./observability/logger.js";
import { buildApp } from "./server/app.js";

const logger = buildLogger();

const app = express();
app.use(pinoHttp());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

buildApp(app);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  logger.info({ port }, "server_listening");
});
