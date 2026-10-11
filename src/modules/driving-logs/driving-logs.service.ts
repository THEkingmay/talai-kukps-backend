import db from "../../db/index.ts";
import redisService from "../../services/redis.service.ts";
import { redisKeys } from "../../services/redis-keys.ts";
import { drivingLogs, carDriverShifts, users, cars } from "../../db/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import type { DrivingLog } from "../../db/types.ts";
import {
  NotFoundError,
  ConflictError,
} from "../../middlewares/error.middleware.ts";
// Redis value shape สำหรับ driver state
export interface DriverRedisState {
  status: "active";
  carId: string;
  driverName: string | null;
  driverPhone: string | null;
  carNumber: string | null;
}

async function setDriverRedisState(
  carId: string,
  state: DriverRedisState,
): Promise<void> {
  await redisService.set(redisKeys.car.currentState(carId), state);
}

// คนขับกดเริ่มงาน — ตรวจ shift แล้ว insert log + sync Redis */
export async function startDriving(
  shiftId: string,
  driverId: string,
): Promise<DrivingLog> {
  // ตรวจว่า shift นี้ถูก assign ให้ driver คนนี้จริง
  const [shift] = await db
    .select({
      shift: carDriverShifts,
      driverName: users.firstName,
      driverPhone: users.phoneNumber,
      carNumber: cars.carNumber,
    })
    .from(carDriverShifts)
    .innerJoin(users, eq(carDriverShifts.driverId, users.id))
    .innerJoin(cars, eq(carDriverShifts.carId, cars.id))
    .where(
      and(
        eq(carDriverShifts.id, shiftId),
        eq(carDriverShifts.driverId, driverId),
      ),
    )
    .limit(1);

  if (!shift)
    throw new NotFoundError("ไม่พบ shift หรือคุณไม่มีสิทธิ์เริ่มงาน shift นี้");

  // ตรวจสอบว่าไม่มี log ที่กำลังยู่ ไม่ให้เพิ่มซ้ำ
  const [existingLog] = await db
    .select()
    .from(drivingLogs)
    .where(
      and(eq(drivingLogs.status, "active"), eq(drivingLogs.shiftId, shiftId)),
    )
    .limit(1);
  if (existingLog)
    throw new ConflictError("มี log ที่กำลังทำอยู่ กรุณาจบก่อนเริ่มงานใหม่");

  // insert driving log
  const [log] = await db
    .insert(drivingLogs)
    .values({ shiftId, status: "active" })
    .returning();
  // sync Redis — reset alertSentAt ด้วย เผื่อเคย alert ไปแล้วก่อนหน้า
  const state: DriverRedisState = {
    status: "active",
    carId: shift.shift.carId,
    // logId: log.id,
    driverName: shift.driverName,
    driverPhone: shift.driverPhone,
    carNumber: shift.carNumber,
  };
  await setDriverRedisState(shift.shift.carId, state);
  // เคลีย alreadySent flag
  await redisService.delete(redisKeys.car.lastSended(shift.shift.carId));
  return log;
}

//คนขับกดหยุดงาน — update log + update Redis */
export async function endDriving(
  logId: string,
  driverId: string,
): Promise<DrivingLog> {
  // ดึง log พร้อม join shift เพื่อตรวจสิทธิ์และได้ carId
  const [result] = await db
    .select({
      log: drivingLogs,
      carId: carDriverShifts.carId,
    })
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
    .where(
      and(
        eq(drivingLogs.id, logId),
        eq(carDriverShifts.driverId, driverId),
        eq(drivingLogs.status, "active"),
      ),
    )
    .limit(1);

  if (!result) {
    throw new Error("ไม่พบ log ที่กำลัง active หรือคุณไม่มีสิทธิ์หยุดงานนี้");
  }

  // update DB
  const [updated] = await db
    .update(drivingLogs)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(drivingLogs.id, logId))
    .returning();

  // ลบจาก redis
  await redisService.delete(redisKeys.car.currentState(result.carId));
  return updated;
}

/** GET /driving-logs/current — Driver ดูงานที่กำลังทำอยู่ */
export async function getCurrentDriving(
  driverId: string,
): Promise<DrivingLog | null> {
  const [res] = await db
    .select({ log: drivingLogs })
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
    .where(
      and(
        eq(drivingLogs.status, "active"),
        eq(carDriverShifts.driverId, driverId),
      ),
    )
    .orderBy(desc(drivingLogs.startedAt))
    .limit(1);

  return res?.log ?? null;
}

//  Driver ดูประวัติการขับของตัวเอง */
export async function getMyLogs(
  driverId: string,
): Promise<
  { log: DrivingLog; carId: string; shiftStartTime: Date; shiftEndTime: Date }[]
> {
  const rows = await db
    .select({
      log: drivingLogs,
      carId: carDriverShifts.carId,
      shiftStartTime: carDriverShifts.startTime,
      shiftEndTime: carDriverShifts.endTime,
    })
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
    .where(eq(carDriverShifts.driverId, driverId))
    .orderBy(drivingLogs.startedAt);

  return rows;
}

//  Admin ดู driving logs ทั้งหมด */
export async function getAll(
  driverId?: string,
): Promise<{ log: DrivingLog; driverId: string; carId: string }[]> {
  if (driverId) {
    const rows = await db
      .select({
        log: drivingLogs,
        driverId: carDriverShifts.driverId,
        carId: carDriverShifts.carId,

      })
      .from(drivingLogs)
      .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
      .where(eq(carDriverShifts.driverId, driverId))
      .orderBy(drivingLogs.startedAt);
    return rows;
  }
  const rows = await db
    .select({
      log: drivingLogs,
      driverId: carDriverShifts.driverId,
      carId: carDriverShifts.carId,
    })
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
    .orderBy(drivingLogs.startedAt);

  return rows;
}

export async function getActiveAll(): Promise<{ log: DrivingLog; driverId: string; carId: string }[]> {
  const rows = await db
    .select({
      log: drivingLogs,
      driverId: carDriverShifts.driverId,
      driverName: users.firstName,
      driverPhone: users.phoneNumber,
      profileImageUrl: users.profileImageUrl,
      carId: carDriverShifts.carId,
      carNumber: cars.carNumber,

    })
    .from(drivingLogs)
    .innerJoin(carDriverShifts, eq(drivingLogs.shiftId, carDriverShifts.id))
    .innerJoin(users, eq(carDriverShifts.driverId, users.id))
    .innerJoin(cars, eq(carDriverShifts.carId, cars.id))
    .where(eq(drivingLogs.status, "active"))
    .orderBy(drivingLogs.startedAt);

  return rows;
}