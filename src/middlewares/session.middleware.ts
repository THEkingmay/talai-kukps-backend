import type { Request, Response, NextFunction } from "express";
import redisService from "../services/redis.service.ts";
import type { SessionUserType } from "../db/custom-types.ts";

export async function sessionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
        return res.status(401).send("Unauthorized");
    }
    // ตรวจสอบสิทธิ์ผู้ใช้จาก Redis
    const users = await redisService.hGetAll<SessionUserType>(
        `session:${sessionId}`,
    );
    if (!users) {
        return res.status(401).send("Unauthorized");
    }
    next();
}
