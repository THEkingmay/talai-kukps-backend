import { Router } from "express";
import { sessionMiddleware } from "../middlewares/session.middleware.ts";

const router = Router();
router.use(sessionMiddleware);

router.get("/", (req, res) => {
    res.send("USERS");
});

export default router;
