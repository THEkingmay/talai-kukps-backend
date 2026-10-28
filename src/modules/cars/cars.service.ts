import db from "../../db/index.ts";
import {
  cars,
  carHistoryLog,
  carDriverShifts,
  users,
} from "../../db/schema.ts";
import { eq, desc, isNull, and, gte, lte } from "drizzle-orm";
import type { NewCar, ResponseCarData } from "../../db/types.ts";
import {
  BadRequestError,
  NotFoundError,
} from "../../middlewares/error.middleware.ts";
import { generateMqttCredential } from "./utils/mqtt-credential.ts";
import redisService from "../../services/redis.service.ts";
import { redisKeys } from "../../services/redis-keys.ts";
import type { MqttMessageType } from "../../types/index.ts";
import type { WebSocketLocationBroadcastType } from "../../types/index.ts";
import { decryptPassword } from "./utils/mqtt-credential.ts";
import type { Request } from "express";

export async function getAll(req: Request): Promise<ResponseCarData[]> {
  // ตรวจสอบ req.user ถ้าเป็น แอดมินให้ส่งที่ลบกลับไปด้วย
  // แต่ถ้าไม่ใช่แอดมินให้ส่งที่ไม่ถูกลบกลับไป
  const NOW = new Date();

  if (req.user && ["admin", "superadmin"].includes(req.user.role)) {
    const carList = await db
      .select({
        id: cars.id,
        createdAt: cars.createdAt,
        deletedAt: cars.deletedAt,
        status: cars.status,
        updatedBy: cars.updatedBy,
        updatedAt: cars.updatedAt,
        routeId: cars.routeId,
        carNumber: cars.carNumber,
        driverData: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
        },
      })
      .from(cars)
      .leftJoin(
        carDriverShifts,
        and(
          eq(cars.id, carDriverShifts.carId),
          lte(carDriverShifts.startTime, NOW),
          gte(carDriverShifts.endTime, NOW),
        ),
      )
      .leftJoin(users, eq(carDriverShifts.driverId, users.id))
      .orderBy(cars.createdAt);
    return carList;
  }
  // ถ้าไม่ใช่แอดมินให้ส่งที่ไม่ถูกลบกลับไป
  const carList = await db
    .select({
      id: cars.id,
      createdAt: cars.createdAt,
      deletedAt: cars.deletedAt,
      status: cars.status,
      updatedBy: cars.updatedBy,
      updatedAt: cars.updatedAt,
      routeId: cars.routeId,
      carNumber: cars.carNumber,
      driverData: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        email: users.email,
      },
    })
    .from(cars)
    .leftJoin(
      carDriverShifts,
      and(
        eq(cars.id, carDriverShifts.carId),
        lte(carDriverShifts.startTime, NOW),
        gte(carDriverShifts.endTime, NOW),
      ),
    )
    .leftJoin(users, eq(carDriverShifts.driverId, users.id))
    .where(isNull(cars.deletedAt))
    .orderBy(cars.createdAt);
  return carList;
}

// รถที่ยังไม่ถูกลบ พร้อมสายที่ Admin กำหนด สำหรับใช้ภายใน server (เช่น ตัวรับ MQTT) ซึ่งไม่มี request
export async function getActiveCarRoutes(): Promise<
  { id: string; routeId: string | null }[]
> {
  return db
    .select({
      id: cars.id,
      routeId: cars.routeId,
    })
    .from(cars)
    .where(isNull(cars.deletedAt));
}

export async function getById(
  id: string,
  req: Request,
): Promise<ResponseCarData | null> {
  // ตรวจสอบ req.user ถ้าเป็น แอดมินให้ส่งที่ลบกลับไปด้วย
  // แต่ถ้าไม่ใช่แอดมินให้ส่งที่ไม่ถูกลบกลับไป
  const NOW = new Date();
  if (req.user && ["admin", "superadmin"].includes(req.user.role)) {
    const [carData] = await db
      .select({
        id: cars.id,
        createdAt: cars.createdAt,
        deletedAt: cars.deletedAt,
        status: cars.status,
        updatedBy: cars.updatedBy,
        updatedAt: cars.updatedAt,
        routeId: cars.routeId,
        carNumber: cars.carNumber,
        driverData: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          email: users.email,
        },
      })
      .from(cars)
      .leftJoin(
        carDriverShifts,
        and(
          eq(cars.id, carDriverShifts.carId),
          lte(carDriverShifts.startTime, NOW),
          gte(carDriverShifts.endTime, NOW),
        ),
      )
      .leftJoin(users, eq(carDriverShifts.driverId, users.id))
      .where(eq(cars.id, id))
      .limit(1);
    return carData;
  }
  // ถ้าไม่ใช่แอดมินให้ส่งที่ไม่ถูกลบกลับไป
  const [carData] = await db
    .select({
      id: cars.id,
      createdAt: cars.createdAt,
      deletedAt: cars.deletedAt,
      status: cars.status,
      updatedBy: cars.updatedBy,
      updatedAt: cars.updatedAt,
      routeId: cars.routeId,
      carNumber: cars.carNumber,
      driverData: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        email: users.email,
      },
    })
    .from(cars)
    .leftJoin(
      carDriverShifts,
      and(
        eq(cars.id, carDriverShifts.carId),
        lte(carDriverShifts.startTime, NOW),
        gte(carDriverShifts.endTime, NOW),
      ),
    )
    .leftJoin(users, eq(carDriverShifts.driverId, users.id))
    .where(and(isNull(cars.deletedAt), eq(cars.id, id)))
    .limit(1);
  return carData;
}

export async function create(
  body: NewCar,
  updatedBy: string,
): Promise<ResponseCarData> {
  const mqttCreds = generateMqttCredential();
  const [car] = await db
    .insert(cars)
    .values({
      carMqttUsername: mqttCreds.carMqttUsername,
      encryptedMqttPassword: mqttCreds.encryptedMqttPassword,
      ...body,
      updatedBy,
    })
    .returning();
  const { encryptedMqttPassword, carMqttUsername, ...resData } = car;
  return resData;
}

// แก้ได้แค่ เลขรถ , routeId
export async function update(
  id: string,
  body: Partial<NewCar>,
  updatedBy: string,
): Promise<ResponseCarData> {
  const [car] = await db
    .update(cars)
    .set({ ...body, updatedBy, updatedAt: new Date() })
    .where(eq(cars.id, id))
    .returning();
  if (!car) throw new NotFoundError("ไม่พบข้อมูลรถในระบบ");
  const { encryptedMqttPassword, carMqttUsername, ...resData } = car;
  return resData;
}

export async function remove(id: string, updatedBy: string): Promise<void> {
  // ตรวจสอบว่า รถคันนี้มีงานที่ขับในอนาคตหรือกำลังขับอยู่หรือไม่ ถ้ามีไม่ให้ลบ
  const now = new Date();
  const exitingCarUsingInShift = await db
    .select({ id: carDriverShifts.id })
    .from(carDriverShifts)
    .where(
      and(eq(carDriverShifts.carId, id), gte(carDriverShifts.endTime, now)),
    );
  if (exitingCarUsingInShift.length > 0)
    throw new BadRequestError("ไม่สามารถลบรถที่ถูกมอบหมายงานในอนาคตได้");

  await db
    .update(cars)
    .set({ deletedAt: new Date(), updatedBy, updatedAt: new Date() })
    .where(eq(cars.id, id));
}

export async function restore(id: string, updatedBy: string): Promise<void> {
  await db
    .update(cars)
    .set({ deletedAt: null, updatedBy, updatedAt: new Date() })
    .where(eq(cars.id, id));
}

export async function updateStatusFromServer(
  carId: string,
  status: "active" | "inactive",
): Promise<void> {
  await db.update(cars).set({ status }).where(eq(cars.id, carId));
}

/** ดึงตำแหน่งล่าสุดของรถทุกคันจาก Redis สำหรับ initial state ตอน frontend โหลดครั้งแรก */
// บางครั้่งใน redis จะไม่มีข้อมูลรถ เช่น เซิฟล่ม หรือเกิดข้อผิดพลาดในการอัปเดตข้อมูล
// ให้ไปดึงตำแหน่งล่าสุดจาก supabaseแทน และให้ status เป็น "inactive" ถ้าไม่มีข้อมูลใน redis
export async function getLivePositions(): Promise<
  WebSocketLocationBroadcastType[]
> {
  const keys = await redisService.keys(redisKeys.car.positionPattern);
  let results: WebSocketLocationBroadcastType[] = [];

  for (const key of keys) {
    const carData = await redisService.hGetAll<MqttMessageType>(key);
    if (!carData || !carData.lat || !carData.lng) continue;

    const carId = redisKeys.car.idFromPositionKey(key);
    results.push({ type: "location", carId, ...carData });
  }

  const allCarId = await db
    .select({ id: cars.id, is_deleted: cars.deletedAt })
    .from(cars);

  // ลบรถที่ลบแล้วออกจาก results
  results = results.filter((car) =>
    allCarId.some((c) => c.id === car.carId && c.is_deleted === null),
  );

  const filterCarNotInRedisAndNotDeleted = allCarId.filter(
    (car) => !keys.includes(`car:${car.id}`) && car.is_deleted === null,
  );
  const filterCarNotInRedisAndNotDeletedIds =
    filterCarNotInRedisAndNotDeleted.map((car) => car.id);

  if (filterCarNotInRedisAndNotDeletedIds.length === 0) return results;

  // เมื่อได้ไอดีของรถที่ไม่มีใน redis แล้วให้ไปดึงประัติกาเดินทางล่าสุดมา
  for (const carId of filterCarNotInRedisAndNotDeletedIds) {
    const carHistory = await db
      .select()
      .from(carHistoryLog)
      .where(eq(carHistoryLog.carId, carId))
      .orderBy(desc(carHistoryLog.createdAt))
      .limit(1);
    if (carHistory.length === 0) continue;
    const { lat, lng, createdAt } = carHistory[0];
    results.push({
      type: "location",
      carId,
      lat,
      lng,
      status: "inactive",
      createdAt: createdAt.toISOString(),
    });
  }

  return results;
}

export async function getMqttCredentials(
  id: string,
): Promise<{ carMqttUsername: string; decryptedMqttPassword: string }> {
  const car = await db.select().from(cars).where(eq(cars.id, id)).limit(1);
  if (!car || !car[0].carMqttUsername || !car[0].encryptedMqttPassword)
    throw new NotFoundError("ไม่พบข้อมูลรถในระบบ");

  const { carMqttUsername, encryptedMqttPassword } = car[0];
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is not defined in environment variables");
  }

  const decryptedMqttPassword = decryptPassword(
    encryptedMqttPassword,
    ENCRYPTION_KEY,
  );

  return {
    carMqttUsername,
    decryptedMqttPassword,
  };
}

export async function resetMqttCredentials(id: string): Promise<void> {
  const newCredentials = generateMqttCredential();
  await db.update(cars).set(newCredentials).where(eq(cars.id, id));
}
