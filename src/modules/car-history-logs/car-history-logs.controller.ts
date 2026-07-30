import type { Request, Response, NextFunction } from "express";
import * as carHistoryLogsService from "./car-history-logs.service.ts";
import { z } from "zod";

const carIdSchema = z.object({ carId: z.string().uuid() });

export async function getByCarId(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { carId } = carIdSchema.parse(req.params);
        const result = await carHistoryLogsService.getByCarId(carId);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
