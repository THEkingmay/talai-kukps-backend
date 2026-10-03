import type { Request, Response, NextFunction } from "express";
import * as notificationsService from "./notifications.service.ts";
import { notificationAlertTypeSchema } from "../../db/types.ts";
import { z } from "zod";

const querySchema = z.object({
  carId: z.string().uuid().optional(),
  alertType: notificationAlertTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /notifications?carId=&alertType=&from=&to=&limit=&offset=
export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "ไม่มีสิทธิ์ในการดูบันทึกแจ้งเตือน",
      });
    }

    const { carId, alertType, from, to, limit, offset } = querySchema.parse(
      req.query,
    );
    const data = await notificationsService.getNotifications({
      alertType,
      from,
      to,
      limit,
      offset,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
