import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as notificationsController from "./notifications.controller.ts";

const router = Router();
router.use(sessionMiddleware);

// GET /notifications
router.get("/", notificationsController.getNotifications);

export default router;
