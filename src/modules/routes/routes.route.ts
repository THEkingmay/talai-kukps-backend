import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as routesController from "./routes.controller.ts";

const router = Router();
router.use(sessionMiddleware);

router.get("/", routesController.getAll);
router.get("/:id", routesController.getById);
router.post("/", routesController.create);
router.patch("/:id", routesController.update);
router.delete("/:id", routesController.remove);

export default router;
