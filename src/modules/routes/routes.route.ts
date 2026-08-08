import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import { mobileTokenMiddleware } from "../../middlewares/mobile-access.middleware.ts";
import * as routesController from "./routes.controller.ts";

const router = Router();

// public routes
router.get("/", mobileTokenMiddleware, routesController.getAll);
router.get("/:id", mobileTokenMiddleware, routesController.getById);

// protected routes
router.post("/", sessionMiddleware, routesController.create);
router.patch("/:id", sessionMiddleware, routesController.update);
router.delete("/:id", sessionMiddleware, routesController.remove);

export default router;
