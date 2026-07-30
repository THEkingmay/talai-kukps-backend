import type { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service.ts";
import { insertUserSchema } from "../../db/types.ts";
import { z } from "zod";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const result = await authService.login(email, password, res);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function register(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const body = insertUserSchema.parse(req.body);
        const result = await authService.register(body, res);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const sessionId = req.cookies.sessionId;
        await authService.logout(sessionId, res);
        res.json({ success: true, message: "Logged out" });
    } catch (error) {
        next(error);
    }
}
