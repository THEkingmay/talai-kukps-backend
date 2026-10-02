import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import redisService from "../services/redis.service.ts";
import { redisKeys } from "../services/redis-keys.ts";
import type { SessionUserType } from "../types/index.ts";

export async function mobileTokenMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const token = req.headers["x-mobile-token"] as string;
    const expectedToken = process.env.MOBILE_ACCESS_TOKEN;

    if (!expectedToken) {
        console.error("[SECURITY] MOBILE_ACCESS_TOKEN is not defined in env");
        return res.status(500).json({
            success: false,
            message: "เกิดข้อผิดพลาดในการตั้งค่าระบบ",
        });
    }

    // 1. ตรวจสอบกรณีมี Mobile Access Token ส่งมา (จาก Mobile App)
    if (token) {
        try {
            const tokenBuffer = Buffer.from(token);
            const expectedBuffer = Buffer.from(expectedToken);

            if (
                tokenBuffer.length === expectedBuffer.length &&
                crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
            ) {
                return next();
            }
        } catch {

        }
        return res.status(403).json({
            success: false,
            message: "คีย์ยืนยันตัวตนไม่ถูกต้อง (Invalid Mobile Token)",
        });
    }

    // 2. กรณีไม่มี Mobile Token ให้ตรวจสอบ Session Cookie (สำหรับ Web Admin Fallback)
    const sessionId = req.cookies.sessionId;
    if (!sessionId) {
        return res.status(401).json({
            success: false,
            message: "กรุณาระบุ Mobile Token หรือเข้าสู่ระบบก่อนใช้งาน",
        });
    }

    const user = await redisService.hGetAll<SessionUserType>(
        redisKeys.session(sessionId),
    );
    if (!user) {
        return res.status(401).json({
            success: false,
            message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
        });
    }

    req.user = user;
    next();
}
