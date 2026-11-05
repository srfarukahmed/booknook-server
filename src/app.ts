import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";
import { MongoServerError } from "mongodb";
import { getConfig } from "../../packages/auth/dist/index.js";
import { libraryRoutes } from "./routes.js";
import { HttpError } from "./errors.js";
import { database } from "./database.js";
export function createApp() {
  const app = express();
  const config = getConfig();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.CLIENT_ORIGIN) callback(null, true);
        else callback(new HttpError(403, "This origin is not allowed."));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again later." },
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/health", async (_req, res) => {
    const { db } = await database();
    await db.command({ ping: 1 });
    res.json({ status: "ok", service: "booknook-api" });
  });
  app.use(libraryRoutes());
  app.use((_req, _res, next) =>
    next(new HttpError(404, "API route not found.")),
  );
  const handler: express.ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({
          message: error.issues
            .map(
              (issue) =>
                `${issue.path.join(".") || "Request"}: ${issue.message}`,
            )
            .join("; "),
        });
      return;
    }
    if (error instanceof MongoServerError && error.code === 11000) {
      res
        .status(409)
        .json({ message: "You already have a copy of this book." });
      return;
    }
    if (error?.type === "entity.too.large") {
      res
        .status(413)
        .json({
          message:
            "Request body exceeds 32 KB. Upload images to imgbb and submit the URL.",
        });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ message: "Invalid JSON request body." });
      return;
    }
    console.error(
      "API request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    res
      .status(503)
      .json({
        message:
          "The library service is temporarily unavailable. Please try again.",
      });
  };
  app.use(handler);
  return app;
}
