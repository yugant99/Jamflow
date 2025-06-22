import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextFunction, Request, Response } from "express";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.cachedFixedWindow(100, "1m"),
  ephemeralCache: new Map(),
  analytics: true,
});
