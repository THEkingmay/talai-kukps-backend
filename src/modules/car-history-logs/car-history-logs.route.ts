import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as carHistoryLogsController from "./car-history-logs.controller.ts";

const router = Router();
router.use(sessionMiddleware);

// GET /car-history-logs/by-car/:carId
router.get("/by-car/:carId", carHistoryLogsController.getByCarId);

export default router;
