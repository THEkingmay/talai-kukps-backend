import type {
  UpdatedCarDriverShift,
  NewCarDriverShift,
} from "../../db/types.ts";
import db from "../../db/index.ts";
import { eq, and, isNull } from "drizzle-orm";
import { carDriverShifts, cars } from "../../db/schema.ts";

export async function getAll() {
  const assignmentDrivers = await db.select().from(carDriverShifts);
  return assignmentDrivers;
}
export async function getById(id: string) {
  const assignmentDriver = await db
    .select()
    .from(carDriverShifts)
    .where(eq(carDriverShifts.id, id));
  return assignmentDriver;
}

export async function getByDriverId(id: string, role: string) {
  if (role === "driver") {
    //ไม่ส่งที่รถถูกลบออกไป
    const assignmentDrivers = await db
      .select({
        id: carDriverShifts.id,
        createdAt: carDriverShifts.createdAt,
        updatedBy: carDriverShifts.updatedBy,
        updatedAt: carDriverShifts.updatedAt,
        carId: carDriverShifts.carId,
        driverId: carDriverShifts.driverId,
        startTime: carDriverShifts.startTime,
        endTime: carDriverShifts.endTime,
      })
      .from(carDriverShifts)
      .innerJoin(cars, eq(carDriverShifts.carId, cars.id))
      .where(and(eq(carDriverShifts.driverId, id), isNull(cars.deletedAt)));
    return assignmentDrivers;
  }
  const assignmentDrivers = await db
    .select()
    .from(carDriverShifts)
    .where(eq(carDriverShifts.driverId, id));
  return assignmentDrivers;
}

export async function create(data: NewCarDriverShift) {
  const assignmentDriver = await db
    .insert(carDriverShifts)
    .values(data)
    .returning();
  return assignmentDriver;
}
export async function update(id: string, data: UpdatedCarDriverShift) {
  const updatedAssignmentDriver = await db
    .update(carDriverShifts)
    .set(data)
    .where(eq(carDriverShifts.id, id))
    .returning();
  return updatedAssignmentDriver;
}
export async function deleteById(id: string) {
  await db
    .delete(carDriverShifts)
    .where(eq(carDriverShifts.id, id))
    .returning();
}
