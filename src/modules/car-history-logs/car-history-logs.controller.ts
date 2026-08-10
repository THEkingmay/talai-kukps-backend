import type { Request, Response, NextFunction } from "express";
import * as carHistoryLogsService from "./car-history-logs.service.ts";
import { z } from "zod";

const carIdSchema = z.object({ carId: z.string().uuid() });
const querySchema = z.object({
    limit: z.coerce.number().min(1).default(50),
});

export async function getByCarId(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { carId } = carIdSchema.parse(req.params);
        const { limit } = querySchema.parse(req.query);
        const result = await carHistoryLogsService.getByCarId(carId, limit);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}
