import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as routePointsController from "./route-points.controller.ts";

const router = Router();
router.use(sessionMiddleware);

// GET /route-points/by-route/:routeId  — get all points for a route (ordered by sequence)
router.get("/by-route/:routeId", routePointsController.getByRouteId);
router.post("/", routePointsController.create);
router.patch("/:id", routePointsController.update);
router.delete("/:id", routePointsController.remove);

export default router;
