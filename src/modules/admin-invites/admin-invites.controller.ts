import type { Request, Response, NextFunction } from "express";
import * as adminInvitesService from "./admin-invites.service.ts";
import { z } from "zod";
import { BadRequestError, ForbiddenError} from "../../middlewares/error.middleware.ts";

const emailSchema = z.object({
    email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
});

export async function getAll(req: Request, res: Response, next: NextFunction) {
  // superadmin เท่านั้นที่จัดการสิทธิของผู้ใช้ได้
    if (req.user?.role !== 'superadmin') {
        throw new ForbiddenError("ไม่มีสิทธิ์ในการดูรายการคำเชิญ");
    }
    try {
        const result = await adminInvitesService.getAll();
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function invite(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.user?.role !== 'superadmin') {
        throw new ForbiddenError("ไม่มีสิทธิ์ในการเพิ่มคำเชิญ");
    }
        const parseResult = emailSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw new BadRequestError(
                parseResult.error.issues[0]?.message || "รูปแบบอีเมลไม่ถูกต้อง",
            );
        }
        const { email } = parseResult.data;
        const result = await adminInvitesService.invite(email, req.user!.id);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
  try {
    // superadmin เท่านั้นที่จัดการสิทธิของผู้ใช้ได้
      if (req.user?.role !== 'superadmin') {
          throw new ForbiddenError("ไม่มีสิทธิ์ในการยกเลิกคำเชิญ");
      }
        const parseResult = emailSchema.safeParse(req.params);
        if (!parseResult.success) {
            throw new BadRequestError(
                parseResult.error.issues[0]?.message || "รูปแบบอีเมลไม่ถูกต้อง",
            );
        }
        const { email } = parseResult.data;
        await adminInvitesService.revoke(email);
        res.json({ success: true, message: "ยกเลิกคำเชิญเรียบร้อยแล้ว" });
    } catch (error) {
        next(error);
    }
}
