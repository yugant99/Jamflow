import { Router } from "express";
import logout, { changePassword, test } from "../controllers/auth";
import { validateToken } from "../controllers/middleware";
import {
  createChat,
  deleteChat,
  shareChat,
  unshareChat,
  updateChat,
  generateResponseFromPrompt,
} from "../controllers/chat";

export const router = Router();

// @ts-ignore
router.use(validateToken);

router.get("/test", test);
// @ts-ignore
router.put("/auth/change-password", changePassword);
// @ts-ignore
router.post("/auth/logout", logout);

// @ts-ignore
router.post("/chat", createChat);
// @ts-ignore
router.post("/chat/:id", generateResponseFromPrompt);
// @ts-ignore
router.put("/chat/:id", updateChat);
// @ts-ignore
router.delete("/chat/:id", deleteChat);

// @ts-ignore
router.post("/share/:id", shareChat);
// @ts-ignore
router.post("/unshare/:id", unshareChat);

export default router;
