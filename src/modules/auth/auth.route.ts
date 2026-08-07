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

router.post('/request-reset-password', authController.requestResetPassword); // body {email: string}
router.post('/reset-password', authController.resetPassword); // body {token: string, password: string}

export default router;
