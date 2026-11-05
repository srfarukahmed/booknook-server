import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import type { RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { getConfig } from "../../packages/auth/dist/index.js";
import { database } from "./database.js";
import { HttpError } from "./errors.js";
import type { Reader } from "./models.js";
declare global {
  namespace Express {
    interface Locals {
      reader: Reader;
    }
  }
}
export function jwtGuard(): RequestHandler {
  const config = getConfig();
  const keys = createRemoteJWKSet(
    new URL("/api/auth/jwks", config.BETTER_AUTH_URL),
    { timeoutDuration: 5000, cooldownDuration: 1000 },
  );
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || "");
    if (!match?.[1])
      return next(new HttpError(401, "A valid Bearer token is required."));
    try {
      const { payload } = await jwtVerify(match[1], keys, {
        issuer: config.BETTER_AUTH_URL,
        audience: config.JWT_AUDIENCE,
        algorithms: ["EdDSA"],
        requiredClaims: ["sub", "sid", "exp", "iat"],
      });
      if (!payload.sub || typeof payload.sid !== "string")
        throw new HttpError(401, "Invalid token claims.");
      const { db } = await database();
      // Adapter uses ObjectIds internally; JWT subjects/session IDs are strings.
      const sessionId = ObjectId.isValid(payload.sid)
        ? new ObjectId(payload.sid)
        : payload.sid;
      const userId = ObjectId.isValid(payload.sub)
        ? new ObjectId(payload.sub)
        : payload.sub;
      const session = await db
        .collection("session")
        .findOne({
          _id: sessionId as ObjectId,
          expiresAt: { $gt: new Date() },
        });
      if (!session || String(session.userId) !== payload.sub)
        throw new HttpError(
          401,
          "Your session expired or was signed out. Please log in again.",
        );
      const user = await db
        .collection("user")
        .findOne({ _id: userId as ObjectId });
      if (
        !user ||
        typeof user.name !== "string" ||
        typeof user.email !== "string"
      )
        throw new HttpError(401, "Account not found.");
      res.locals.reader = {
        id: payload.sub,
        name: user.name,
        email: user.email,
      };
      next();
    } catch (e) {
      if (e instanceof HttpError) return next(e);
      if (e instanceof joseErrors.JOSEError)
        return next(new HttpError(401, "Token is invalid or expired."));
      next(e);
    }
  };
}
