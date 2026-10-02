import type { Request, Response, NextFunction } from "express";
import redisService from "../services/redis.service.ts";
import { redisKeys } from "../services/redis-keys.ts";
import type { SessionUserType } from "../types/index.ts";

export async function sessionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
        return res
            .status(401)
            .json({ success: false, message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" });
    }

    const user = await redisService.hGetAll<SessionUserType>(
        redisKeys.session(sessionId),
    );
    if (!user) {
        return res
            .status(401)
            .json({ success: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    }

    req.user = user;
    next();
}
