import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import { mobileTokenMiddleware } from "../../middlewares/mobile-access.middleware.ts";
import * as routePointsController from "./route-points.controller.ts";

const router = Router();

// GET /route-points/by-route/:routeId  — get all points for a route (ordered by sequence)
router.get(
  "/by-route/:routeId",
  mobileTokenMiddleware,
  routePointsController.getByRouteId,
);
router.post("/", sessionMiddleware, routePointsController.create);
router.patch("/:id", sessionMiddleware, routePointsController.update);
router.delete("/:id", sessionMiddleware, routePointsController.remove);

export default router;
