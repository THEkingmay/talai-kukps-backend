import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as carsController from "./cars.controller.ts";

const router = Router();
router.use(sessionMiddleware);

router.get("/", carsController.getAll);
router.get("/:id", carsController.getById);
router.post("/", carsController.create);
router.patch("/:id", carsController.update);
router.delete("/:id", carsController.remove);

export default router;
