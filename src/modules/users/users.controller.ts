import type { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service.ts";

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await usersService.getAll();
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id;
        const result = await usersService.getById(userId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
