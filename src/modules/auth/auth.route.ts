import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as authController from "./auth.controller.ts";

const router = Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/logout", sessionMiddleware, authController.logout);
router.get(
    "/login-with-session",
    sessionMiddleware,
    authController.loginWithSession,
);

export default router;
