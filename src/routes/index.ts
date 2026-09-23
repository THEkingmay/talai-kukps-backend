import { Router } from "express";
import authRouter from "../modules/auth/auth.route.ts";
import usersRouter from "../modules/users/users.route.ts";
import carsRouter from "../modules/cars/cars.route.ts";
import routesRouter from "../modules/routes/routes.route.ts";
import routePointsRouter from "../modules/route-points/route-points.route.ts";
import adminInvitesRouter from "../modules/admin-invites/admin-invites.route.ts";
import carHistoryLogsRouter from "../modules/car-history-logs/car-history-logs.route.ts";
import assignmentDriverRouter from "../modules/assignment-driver/assignment-driver.route.ts";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/cars", carsRouter);
router.use("/routes", routesRouter);
router.use("/route-points", routePointsRouter);
router.use("/admin-invites", adminInvitesRouter);
router.use("/car-history-logs", carHistoryLogsRouter);
router.use("/assignment-driver", assignmentDriverRouter);

export default router;
