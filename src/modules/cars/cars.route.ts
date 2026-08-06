import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import { mobileTokenMiddleware } from "../../middlewares/mobile-access.middleware.ts";
import * as carsController from "./cars.controller.ts";

const router = Router();

// public route
router.get("/", mobileTokenMiddleware, carsController.getAll);
router.get("/:id", mobileTokenMiddleware, carsController.getById);

// protected  route admin only
router.post("/", sessionMiddleware, carsController.create);
router.patch("/:id", sessionMiddleware, carsController.update);
router.delete("/:id", sessionMiddleware, carsController.remove);

export default router;
