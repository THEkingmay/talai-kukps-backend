import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as drivingLogsController from "./driving-logs.controller.ts";

const router = Router();

router.use(sessionMiddleware);

router.post("/start", drivingLogsController.start);
router.post("/end", drivingLogsController.end);
router.get("/current", drivingLogsController.getCurrent);
router.get("/active/all", drivingLogsController.getActiveAll); // แอดมินดูงานที่กำลังทำทั้งหมด
router.get("/my", drivingLogsController.getMy);
router.get("/", drivingLogsController.getAll);

export default router;
