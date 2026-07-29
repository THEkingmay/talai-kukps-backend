import { Router } from "express";
import { sessionMiddleware } from "../middlewares/session.middleware.ts";

const router = Router();

router.post("/login", (req, res) => {
    res.send("LOGIN");
});

router.post("/register", (req, res) => {
    res.send("REGISTER");
});

router.get("/logout", sessionMiddleware, (req, res) => {
    res.send("LOGOUT");
});

export default router;
