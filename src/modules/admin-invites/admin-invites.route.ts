import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as adminInvitesController from "./admin-invites.controller.ts";

const router = Router();
router.use(sessionMiddleware);

// All admin invite endpoints require admin role (TODO: add adminOnly middleware)
router.get("/", adminInvitesController.getAll);
router.post("/", adminInvitesController.invite);
router.delete("/:email", adminInvitesController.revoke);

export default router;
