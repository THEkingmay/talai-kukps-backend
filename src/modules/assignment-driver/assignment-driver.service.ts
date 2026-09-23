import type {
  UpdatedCarDriverShift,
  NewCarDriverShift,
} from "../../db/types.ts";
import db from "../../db/index.ts";
import { eq } from "drizzle-orm";
import { carDriverShifts } from "../../db/schema.ts";

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

export async function getByDriverId(id: string) {
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
