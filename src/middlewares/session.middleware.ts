import type { Request, Response, NextFunction } from "express";
import redisService from "../services/redis.service.ts";
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
            .json({ success: false, message: "Unauthorized" });
    }

    const user = await redisService.hGetAll<SessionUserType>(
        `session:${sessionId}`,
    );
    if (!user) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    next();
}
