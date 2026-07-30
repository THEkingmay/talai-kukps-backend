import type { Request, Response, NextFunction } from "express";
import * as carsService from "./cars.service.ts";
import { insertCarSchema } from "../../db/types.ts";
import { z } from "zod";

const uuidSchema = z.object({ id: z.string().uuid() });

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await carsService.getAll();
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = uuidSchema.parse(req.params);
        const result = await carsService.getById(id);
        if (!result) return res.status(404).json({ success: false, message: "Car not found" });
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const body = insertCarSchema.parse(req.body);
        const result = await carsService.create(body, req.user!.id);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function update(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = uuidSchema.parse(req.params);
        const body = insertCarSchema.partial().parse(req.body);
        const result = await carsService.update(id, body, req.user!.id);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = uuidSchema.parse(req.params);
        await carsService.remove(id);
        res.json({ success: true, message: "Car deleted" });
    } catch (error) {
        next(error);
    }
}
