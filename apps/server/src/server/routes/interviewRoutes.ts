import type { Express } from "express";
import { z } from "zod";

import type { Container } from "../../wiring/container.js";

const StartInterviewRequest = z.object({
  candidateId: z.string().min(1).optional(),
  role: z.string().min(1).default("backend"),
  level: z.enum(["junior", "mid", "senior"]).default("mid"),
  resumeText: z.string().optional(),
  resumeFileName: z.string().optional()
});

const AnswerRequest = z.object({
  sessionId: z.string().min(1),
  answer: z.string().min(1),
  // Optional: allow client to assert which question they believe they're answering.
  questionId: z.string().min(1).optional()
});

export function registerInterviewRoutes(app: Express, container: Container) {
  app.post("/interview/start", async (req, res, next) => {
    try {
      const body = StartInterviewRequest.parse(req.body ?? {});
      const result = await container.interviewController.startInterview(body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/interview/answer", async (req, res, next) => {
    try {
      const body = AnswerRequest.parse(req.body ?? {});
      const result = await container.interviewController.submitAnswer(body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get("/interview/state", async (req, res, next) => {
    try {
      const sessionId = z.string().min(1).parse(req.query.sessionId);
      const result = await container.interviewController.getState({ sessionId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get("/interview/result", async (req, res, next) => {
    try {
      const sessionId = z.string().min(1).parse(req.query.sessionId);
      const result = await container.interviewController.getResult({ sessionId });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });
}
