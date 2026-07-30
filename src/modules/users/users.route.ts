import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as usersController from "./users.controller.ts";

const router = Router();
router.use(sessionMiddleware);

router.get("/", usersController.getAll);
router.get("/me", usersController.getMe);

export default router;
