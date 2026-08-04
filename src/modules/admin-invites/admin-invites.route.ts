import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as adminInvitesController from "./admin-invites.controller.ts";

const router = Router();

router.get("/", sessionMiddleware, adminInvitesController.getAll);
router.post("/", sessionMiddleware, adminInvitesController.invite);
router.delete("/:email", sessionMiddleware, adminInvitesController.revoke);

export default router;
