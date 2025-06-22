import { Request, Response, NextFunction } from "express";
import { supabase } from "../resources";
import { ratelimit } from "../resources/rate-limit";
import { validateJWT } from "./auth";

export async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(400).json({ error: "Token is required." });
  }

  try {
    const { user } = await validateJWT(token);
    // @ts-ignore
    req.user = user;
    // @ts-ignore
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token." });
  }
}

export default async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ip = req.ip ?? "127.0.0.1";

  const { success, limit, reset, remaining } = await ratelimit.limit(
    `ratelimit_middleware_${ip}`
  );

  if (!success) {
    return res.status(429).json({
      message: "Too many requests, you are blocked temporarily.",
    });
  }

  res.set("X-RateLimit-Limit", limit.toString());
  res.set("X-RateLimit-Remaining", remaining.toString());
  res.set("X-RateLimit-Reset", reset.toString());
  next();
}
