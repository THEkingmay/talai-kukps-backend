import db from "../../db/index.ts";
import redisService from "../../services/redis.service.ts";
import { drivingLogs, carDriverShifts } from "../../db/schema.ts";
import { eq, and } from "drizzle-orm";
import type { DrivingLog } from "../../db/types.ts";

// Redis value shape สำหรับ driver state
export interface DriverRedisState {
  status: "active" | "ended";
  carId: string;
  logId: string;
  alertSentAt: string | null;
}

async function setDriverRedisState(
  driverId: string,
  state: DriverRedisState,
): Promise<void> {
  await redisService.set(`driver:${driverId}`, state);
}

async function setActiveDriverForCar(
  carId: string,
  driverId: string,
): Promise<void> {
  await redisService.set(`car:${carId}:activeDriver`, driverId);
}
// คนขับกดเริ่มงาน — ตรวจ shift แล้ว insert log + sync Redis */
export async function startDriving(
  shiftId: string,
  driverId: string,
): Promise<DrivingLog> {
  // ตรวจว่า shift นี้ถูก assign ให้ driver คนนี้จริง
  const [shift] = await db
    .select()
    .from(carDriverShifts)
    .where(
      and(
        eq(carDriverShifts.id, shiftId),
        eq(carDriverShifts.driverId, driverId),
      ),
    )
    .limit(1);

  if (!shift) {
    throw new Error("ไม่พบ shift หรือคุณไม่มีสิทธิ์เริ่มงาน shift นี้");
  }

  // insert driving log
  const [log] = await db
    .insert(drivingLogs)
    .values({ shiftId, status: "active" })
    .returning();

  // sync Redis — reset alertSentAt ด้วย เผื่อเคย alert ไปแล้วก่อนหน้า
  const state: DriverRedisState = {
    status: "active",
    carId: shift.carId,
    logId: log.id,
    alertSentAt: null,
  };
  await setDriverRedisState(driverId, state);
  await setActiveDriverForCar(shift.carId, driverId);

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

  // update Redis (คง key ไว้เพื่อให้ MQTT ยัง lookup driverId ได้)
  const currentState = (await redisService.get(
    `driver:${driverId}`,
  )) as DriverRedisState | null;

  if (currentState) {
    await setDriverRedisState(driverId, {
      ...currentState,
      status: "ended",
    });
  }

  return updated;
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
export async function getAll(): Promise<
  { log: DrivingLog; driverId: string; carId: string }[]
> {
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
