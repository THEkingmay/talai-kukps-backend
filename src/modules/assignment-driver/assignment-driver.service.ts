import type {
  UpdatedCarDriverShift,
  NewCarDriverShift,
} from "../../db/types.ts";
import db from "../../db/index.ts";
import { eq, and, isNull, sql } from "drizzle-orm";
import { carDriverShifts, cars, drivingLogs, routes } from "../../db/schema.ts";
import {
  BadRequestError,
  NotFoundError,
} from "../../middlewares/error.middleware.ts";

// เคยมี driving log ของ shift นี้หรือยัง (subquery แทน join เพื่อไม่ให้แถว shift ซ้ำ)
const hasDrivingLog = sql<boolean>`exists (
  select 1 from ${drivingLogs}
  where ${drivingLogs.shiftId} = ${carDriverShifts.id}
)`;

// แก้ไข/ลบได้ก็ต่อเมื่อ: ไม่เคยมี log, ยังไม่เลยเวลา และรถยังไม่ถูกลบ
function getEditOption(
  hasLog: boolean,
  startTime: Date,
  endTime: Date,
  carDeletedAt: Date | null,
  now: Date,
): { isEditable: boolean; message: string } {
  if (hasLog)
    return {
      isEditable: false,
      message: "ไม่สามารถแก้ไขงานที่มีประวัติการดำเนินงานได้",
    };
  if (carDeletedAt)
    return {
      isEditable: false,
      message: "ไม่สามารถแก้ไขงานของรถที่ถูกลบแล้วได้",
    };
  if (startTime < now || endTime < now)
    return {
      isEditable: false,
      message: "ไม่สามารถแก้ไขเวลาที่น้อยกว่าปัจจุบันได้",
    };
  return { isEditable: true, message: "" };
}

export async function getAll() {
  const now = new Date();
  const assignmentDrivers = await db
    .select({
      shift: carDriverShifts,
      carDeletedAt: cars.deletedAt,
      hasLog: hasDrivingLog,
      moreData: {
        carNumber: cars.carNumber,
        routeName: routes.name,
      },
    })
    .from(carDriverShifts)
    .leftJoin(cars, eq(carDriverShifts.carId, cars.id))
    .leftJoin(routes, eq(routes.id, cars.routeId));
  return assignmentDrivers.map(({ shift, carDeletedAt, hasLog, moreData }) => ({
    ...shift,
    moreData,
    editOption: getEditOption(
      hasLog,
      shift.startTime,
      shift.endTime,
      carDeletedAt,
      now,
    ),
  }));
}

export async function getByDriverId(id: string) {
  const now = new Date();

  const assignmentDrivers = await db
    .select({
      shift: carDriverShifts,
      carDeletedAt: cars.deletedAt,
      hasLog: hasDrivingLog,
      moreData: {
        carNumber: cars.carNumber,
        routeName: routes.name,
      },
    })
    .from(carDriverShifts)
    .leftJoin(cars, eq(carDriverShifts.carId, cars.id))
    .leftJoin(routes, eq(routes.id, cars.routeId))
    .where(eq(carDriverShifts.driverId, id));
  return assignmentDrivers.map(({ shift, carDeletedAt, hasLog, moreData }) => ({
    ...shift,
    moreData,
    editOption: getEditOption(
      hasLog,
      shift.startTime,
      shift.endTime,
      carDeletedAt,
      now,
    ),
  }));
}

export async function create(data: NewCarDriverShift) {
  const now = new Date();
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);

  if (start < now || end < now)
    throw new BadRequestError("ไม่สามารถเพิ่มงานในเวลาที่น้อยกว่าปัจจุบันได้");

  const [car] = await db
    .select({ isDelete: cars.deletedAt })
    .from(cars)
    .where(eq(cars.id, data.carId));
  if (car.isDelete) {
    throw new BadRequestError("ไม่สามารถเพิ่มงานให้รถที่ถูกลบแล้วได้");
  }

  const assignmentDriver = await db
    .insert(carDriverShifts)
    .values(data)
    .returning();
  return assignmentDriver;
}
export async function update(id: string, data: UpdatedCarDriverShift) {
  // check if shift has logs data
  const logs = await db
    .select()
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, id));
  if (logs.length > 0) {
    throw new BadRequestError("ไม่สามารถแก้ไขงานที่มีประวัติการดำเนินงานได้");
  }
  const now = new Date();
  const start = new Date(data.startTime!);
  const end = new Date(data.endTime!);
  if (start < now || end < now)
    throw new BadRequestError("ไม่สามารถแก้ไขเวลาที่น้อยกว่าปัจจุบันได้");

  if (!data.carId) {
    throw new BadRequestError("ต้องใส่รถสำหรับมอบหมายงาน");
  }
  const [car] = await db
    .select({ isDelete: cars.deletedAt })
    .from(cars)
    .where(eq(cars.id, data.carId));
  if (car.isDelete) {
    throw new BadRequestError("ไม่สามารถเพิ่มงานให้รถที่ถูกลบแล้วได้");
  }

  const updatedAssignmentDriver = await db
    .update(carDriverShifts)
    .set(data)
    .where(eq(carDriverShifts.id, id))
    .returning();
  return updatedAssignmentDriver;
}
export async function deleteById(id: string) {
  //check if shift has log
  const logs = await db
    .select()
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, id));
  if (logs.length > 0) {
    throw new BadRequestError("ไม่สามารถลบงานที่มีประวัติการดำเนินงานได้");
  }

  await db
    .delete(carDriverShifts)
    .where(eq(carDriverShifts.id, id))
    .returning();
}
