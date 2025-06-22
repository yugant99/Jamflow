import { Router } from "express";
import { home } from "../controllers/index";
import { signUp, signIn, test } from "../controllers/auth";
import {
  getChat,
} from "../controllers/chat";
import { validateToken } from "../controllers/middleware";

export const router = Router();

router.get("/", home);
// @ts-ignore
router.post("/auth/signup", signUp);
// @ts-ignore
router.post("/auth/signin", signIn);

// @ts-ignore
router.get("/chat/:id([0-9a-fA-F-]{36})", getChat);

export default router;
