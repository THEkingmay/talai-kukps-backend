import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import { mobileTokenMiddleware } from "../../middlewares/mobile-access.middleware.ts";
import * as carsController from "./cars.controller.ts";

const router = Router();

// public route
router.get("/", mobileTokenMiddleware, carsController.getAll);
// ต้องมาก่อน /:id เพื่อไม่ให้ Express เข้าใจว่า "live-positions" คือ :id
router.get(
  "/live-positions",
  mobileTokenMiddleware,
  carsController.getLivePositions,
);
router.get("/:id", mobileTokenMiddleware, carsController.getById);

// protected  route admin only
router.post("/", sessionMiddleware, carsController.create);
router.patch("/:id", sessionMiddleware, carsController.update);
router.delete("/:id", sessionMiddleware, carsController.remove);

router.get(
  "/mqtt-credentials/:id",
  sessionMiddleware,
  carsController.getMqttCredentials,
);
export default router;
