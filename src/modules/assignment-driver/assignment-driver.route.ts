import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as assignmentDriverController from "./assignment-driver.controller.ts";

const router = Router();

router.get("/", sessionMiddleware, assignmentDriverController.getAll);
router.get(
  "/driver/:id",
  sessionMiddleware,
  assignmentDriverController.getByDriverId,
);
router.post("/", sessionMiddleware, assignmentDriverController.create);
router.put("/:id", sessionMiddleware, assignmentDriverController.update);
router.delete("/:id", sessionMiddleware, assignmentDriverController.deleteById);

export default router;
