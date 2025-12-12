import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import { config } from "../config/config.ts";

export interface AuthRequest extends Request {
  userId: string;
}

const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Check for existing Authorization header
    const authHeader = req.header("Authorization");
    if (!authHeader) {
      return next(createHttpError(401, "Authorization token is required"));
    }

    // 2. Ensure proper "Bearer <token>" format
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return next(createHttpError(401, "Invalid Authorization header format"));
    }

    const token = parts[1];

    // 3. Verify token
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, config.jwtSecret!) as jwt.JwtPayload;
    } catch (err) {
      return next(createHttpError(401, "Invalid or expired token"));
    }

    // 4. Ensure payload contains a subject (user ID)
    if (!decoded?.sub) {
      return next(createHttpError(401, "Invalid token payload"));
    }

    // 5. Attach userId to request object
    const _req = req as AuthRequest;
    _req.userId = decoded.sub as string;

    console.log("Authenticated User:", decoded.sub);

    // 6. Continue to next middleware
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return next(createHttpError(500, "Authentication failed"));
  }
};

export default authenticate;
