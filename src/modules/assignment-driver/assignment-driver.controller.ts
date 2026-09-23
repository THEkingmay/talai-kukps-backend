import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as assignmentDriverService from "./assignment-driver.service.ts";
import * as errorMiddleware from "../../middlewares/error.middleware.ts";
import {
  insertCarDriverShiftSchema,
  updateCarDriverShiftSchema,
} from "../../db/types.ts";

const uuidSchema = z.object({ id: z.string().uuid() });

function checkPermission(req: Request, isDriver: boolean) {
  if (
    req.user &&
    isDriver &&
    !["superadmin", "admin", "driver"].includes(req.user.role)
  ) {
    throw new errorMiddleware.ForbiddenError("ไม่มีสิทธิเข้าถึง");
  } else if (
    req.user &&
    !isDriver &&
    !["superadmin", "admin"].includes(req.user.role)
  ) {
    throw new errorMiddleware.ForbiddenError("ไม่มีสิทธิเข้าถึง");
  }
}

export const getAll = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, false);
    const assignmentDrivers = await assignmentDriverService.getAll();
    res.json({ success: true, data: assignmentDrivers });
  } catch (error) {
    next(error);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, true);
    const { id } = uuidSchema.parse(req.params);
    const assignmentDriver = await assignmentDriverService.getById(id);
    res.json({ success: true, data: assignmentDriver });
  } catch (error) {
    next(error);
  }
};

export const getByDriverId = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, true);
    const { id } = uuidSchema.parse(req.params);
    const assignmentDrivers = await assignmentDriverService.getByDriverId(id);
    res.json({ success: true, data: assignmentDrivers });
  } catch (error) {
    next(error);
  }
};

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, false);
    // console.log("Request Body", req.body);
    const validatedData = insertCarDriverShiftSchema.parse({
      ...req.body,
      updatedBy: req.user?.id,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
    });
    console.log("Validated Data", validatedData);
    const insertedData = await assignmentDriverService.create(validatedData);
    res.json({ success: true, data: insertedData });
  } catch (error) {
    next(error);
  }
};

export const update = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, false);
    const { id } = uuidSchema.parse(req.params);
    // console.log("Request Body", req.body);
    const validatedData = updateCarDriverShiftSchema.parse({
      ...req.body,
      startTime: new Date(req.body.startTime),
      endTime: new Date(req.body.endTime),
      updatedBy: req.user?.id,
      updatedAt: new Date(),
    });
    const updatedData = await assignmentDriverService.update(id, validatedData);
    res.json({ success: true, data: updatedData });
  } catch (error) {
    next(error);
  }
};

export const deleteById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    checkPermission(req, false);
    const { id } = uuidSchema.parse(req.params);
    await assignmentDriverService.deleteById(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
