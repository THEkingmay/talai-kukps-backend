import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as drivingLogsService from "./driving-logs.service.ts";
import {
  ForbiddenError,
  NotFoundError,
} from "../../middlewares/error.middleware.ts";

const startBodySchema = z.object({
  shiftId: z.string().uuid("shiftId ต้องเป็น UUID"),
});

const endBodySchema = z.object({
  logId: z.string().uuid("logId ต้องเป็น UUID"),
});

/** POST /driving-logs/start — Driver กดเริ่มงาน */
export const start = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user?.role !== "driver") {
      throw new ForbiddenError("เฉพาะคนขับเท่านั้นที่สามารถเริ่มงานได้");
    }
    const { shiftId } = startBodySchema.parse(req.body);
    const log = await drivingLogsService.startDriving(shiftId, req.user.id);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

/** POST /driving-logs/end — Driver กดหยุดงาน */
export const end = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "driver") {
      throw new ForbiddenError("เฉพาะคนขับเท่านั้นที่สามารถหยุดงานได้");
    }
    const { logId } = endBodySchema.parse(req.body);
    const log = await drivingLogsService.endDriving(logId, req.user.id);
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

/** GET /driving-logs/current — Driver ดูงานที่กำลังทำอยู่ */
export const getCurrent = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.user?.role !== "driver") {
      throw new ForbiddenError(
        "เฉพาะคนขับเท่านั้นที่สามารถดูงานที่กำลังทำอยู่ได้",
      );
    }
    const log = await drivingLogsService.getCurrentDriving(req.user.id);
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

/** GET /driving-logs/my — Driver ดูประวัติตัวเอง */
export const getMy = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (
      !req.user ||
      !["driver", "admin", "superadmin"].includes(req.user.role)
    ) {
      throw new ForbiddenError("ไม่มีสิทธิ์เข้าถึง");
    }
    const logs = await drivingLogsService.getMyLogs(req.user.id);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

/** GET /driving-logs — Admin ดูทั้งหมด */
export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
      throw new ForbiddenError("ไม่มีสิทธิ์เข้าถึง");
    }
    const logs = await drivingLogsService.getAll();
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
