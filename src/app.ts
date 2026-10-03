import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import redisService from "./services/redis.service.ts";
import mqttService from "./services/mqtt.service.ts";
import websocketService from "./services/websocket.service.ts";
import router from "./routes/index.ts";
import { errorMiddleware } from "./middlewares/error.middleware.ts";
import type { MqttMessageType } from "./types/index.ts";
import { insertMany } from "./modules/car-history-logs/car-history-logs.service.ts";
import http from "http";
import type {
  NewCarHistoryLog,
  NotificationPayloadType_driver_not_confirmed,
} from "./db/types.ts";
import rateLimit from "express-rate-limit";
import emailService from "./services/email.service.ts";
import s3Service from "./services/s3.service.ts";
import { updateStatusFromServer } from "./modules/cars/cars.service.ts";
import { insertNotification } from "./modules/notifications/notifications.service.ts";
import type { DriverRedisState } from "./modules/driving-logs/driving-logs.service.ts";
import { redisKeys } from "./services/redis-keys.ts";

const VALID_STATUSES = ["active", "inactive"] as const;

const ALERT_COOLDOWN_MS = 60 * 1000; // 1 minute

/**
 * ตรวจสอบว่าคนขับที่ควรขับรถคันนี้ได้กดเริ่มงานหรือยัง
 * ถ้าไม่ได้กด (หรือกดหยุดแล้ว) จะส่ง WebSocket alert ไปยัง client ทั้งหมด
 * ส่งได้ครั้งเดียวต่อ session (กัน spam ด้วย alertSentAt flag ใน Redis)
 */
async function checkDriverConfirmation(carId: string): Promise<void> {
  // ดูว่ามี state ของcarId นี้ไหม ถ้ามีแปลว่ากำลังวิ่งถ้าไม่มีแปลว่าไม่ได้กำลังวิ่ง
  const currentState = (await redisService.get(
    redisKeys.car.currentState(carId),
  )) as DriverRedisState | null;

  if (!currentState) {
    // ไม่มีคนขับ assigned ใน Redis เลย (ไม่เคยกดเริ่มงาน)
    await sendDriverAlert(carId);
    return;
  }
}

/**
 * ส่ง WebSocket alert ไปยัง client ทั้งหมด (ครั้งเดียวต่อ session)
 * ถ้า alertSentAt มีค่าแล้ว แปลว่าส่งไปแล้ว — ไม่ส่งซ้ำ
 */
async function sendDriverAlert(carId: string): Promise<void> {
  const lastSended = await redisService.get(redisKeys.car.lastSended(carId));
  if (
    lastSended &&
    new Date().getTime() - new Date(lastSended as string).getTime() <
      ALERT_COOLDOWN_MS
  )
    return;
  await redisService.set(
    redisKeys.car.lastSended(carId),
    new Date().toISOString(),
  );

  const message = "รถกำลังวิ่งแต่คนขับยังไม่ได้กดเริ่มงาน";
  const timestamp = new Date().toISOString();

  console.warn(
    `[ALERT] รถ ${carId} วิ่งอยู่แต่คนขับยังไม่ได้กดเริ่มงาน (driverId: ${carId ?? "ไม่ระบุ"})`,
  );

  // บันทึก log ไว้ใน DB ให้ admin ที่เข้ามาทีหลังดูย้อนหลังได้
  // fire-and-forget: ถ้า DB ชั่วคราว insert fail ไม่ควรบล็อก alert realtime (แค่ log error)
  insertNotification({
    alertType: "driver_not_confirmed",
    message,
    payload: {
      carId,
      timestamp,
    } as NotificationPayloadType_driver_not_confirmed,
  }).catch((err) =>
    console.error("[ALERT] Failed to insert notification:", err),
  );

  websocketService.broadcast({
    type: "alert",
    alertType: "driver_not_confirmed",
    carId,
    message,
    timestamp,
  });
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, //15mins
  limit: 1000, // 1000 req/15mins ~~ 1req/s
  message: {
    status: 429,
    error: "คุณส่ง Request ถี่เกินไป กรุณาลองใหม่ในอีก 15 นาที",
  },
  standardHeaders: true, // คืนค่า RateLimit-* ใน Response Header
  legacyHeaders: false, // ปิด Header แบบเก่า (X-RateLimit-*)
});

async function bootstrap() {
  const app: Express = express();
  const FRONTEND_URL = process.env.FRONTEND_URL;
  console.log("FRONTEND_URL", FRONTEND_URL);
  app.use(
    cors({
      origin: FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(limiter);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(router);
  app.use(errorMiddleware);

  emailService.connect();
  s3Service.connect();

  await redisService.connect(process.env.REDIS_URL!);
  mqttService.connect(process.env.MQTT_URL!, {
    username: process.env.MQTT_SERVER_USERNAME,
    password: process.env.MQTT_SERVER_PASSWORD,
  });
  mqttService.onMessage(async (topic, payload) => {
    // cars/carId = {status:string , lat:number, lng:number , createdAt:string}
    try {
      const carId = topic.replace("cars/", "");

      /* รถส่งมาแค่ {lat:number, lng:number , status : 'active'} */
      // ถ้า mqt เปลี่ยนแปลงแสดงว่ารถมันขยับยังส่งได้ จะได้สถานะเป็น active อัตโนมัติ
      const rawData = JSON.parse(payload.toString());
      //นำ Object ที่แปลงแล้ว มาใส่ค่า createdAt เพิ่มเข้าไป
      const data: MqttMessageType = {
        ...rawData,
        createdAt: new Date().toISOString(),
      };

      const lastState = await redisService.hGetAll<MqttMessageType>(
        redisKeys.car.position(carId),
      );

      // ตรวจสอบว่า status ที่รับมาถูกต้องก่อน
      if (!VALID_STATUSES.includes(data.status)) {
        console.warn(`[MQTT] Invalid status received: ${data.status}`);
        return;
      }

      // แยกกรณีที่ Redis ยังไม่มีข้อมูล (ครั้งแรก) ออกจากกรณีที่ status เปลี่ยน
      const isFirstSeen = !lastState || lastState.status === undefined;
      const isStatusChanged = lastState?.status !== data.status;

      if (isFirstSeen || isStatusChanged) {
        updateStatusFromServer(carId, data.status).catch((err) =>
          console.error("[MQTT] Failed to update car status:", err),
        );
      }

      // ตรวจสอบว่าคนขับ confirm แล้วหรือยัง (เฉพาะตอนรถ active)
      if (data.status === "active") {
        checkDriverConfirmation(carId).catch((err) =>
          console.error("[MQTT] Driver confirmation check failed:", err),
        );
      }

      websocketService.broadcast({
        type: "location",
        carId,
        ...data,
      }); // boardcast ไปหา client ทั้งหมด
      redisService.hSet(redisKeys.car.position(carId), data); // บันทึกไว้ให้ setTinterval วนมาบันทึก logs ทุก ๆ 60 วินาที
    } catch (error) {
      console.error(
        `[MQTT] Error processing message on topic ${topic}:`,
        error,
      );
    }
  });
  const server = http.createServer(app);
  websocketService.init(server);

  // Save car history logs to the database
  const lastSeenMap = new Map<string, string>(); // carId -> createdAt (ISO
  setInterval(async () => {
    try {
      let data: NewCarHistoryLog[] = [];
      const keys = await redisService.keys(redisKeys.car.positionPattern);

      for (const key of keys) {
        const carId = redisKeys.car.idFromPositionKey(key);
        const carData = await redisService.hGetAll<MqttMessageType>(key);

        if (
          !carData ||
          carData.lat === undefined ||
          carData.lng === undefined ||
          carData.lat === 0 ||
          carData.lng === 0 ||
          carData.status === "inactive"
        )
          continue;

        // ตรวจสอบว่าเวลาซ้ำกับครั้งที่แล้วไหม
        const lastSeen = lastSeenMap.get(carId);
        if (lastSeen === carData.createdAt) {
          continue; // ข้ามไปเลย ไม่บันทึกซ้ำ
        }

        data.push({
          carId,
          lat: carData.lat,
          lng: carData.lng,
          createdAt: new Date(carData.createdAt),
        });

        // อัพเดต lastSeen หลัง push แล้ว
        lastSeenMap.set(carId, carData.createdAt);
      }

      console.log(`[WORKER] : saving car history log ${data.length} items`);
      if (data.length === 0) return;
      await insertMany(data);
    } catch (error) {
      console.error(`[WORKER] : saving car history log error`, error);
    }
  }, 60000);
  // คอยตรวจสอบว่ารถได้ส่งตำแหน่งมาไหม ถ้าไม่ส่งมา 5 นาทีจะเปลีย่นสถานะใน Redis เป็น inactive และส่งแจ้งเตือนผ่าน WebSocket
  setInterval(async () => {
    try {
      const keys = await redisService.keys(redisKeys.car.positionPattern);
      for (const key of keys) {
        const carId = redisKeys.car.idFromPositionKey(key);
        const carData = await redisService.hGetAll<MqttMessageType>(key);
        if (
          !carData ||
          carData.lat === undefined ||
          carData.lng === undefined ||
          carData.lat === 0 ||
          carData.lng === 0 ||
          carData.status === "inactive"
        )
          continue;

        if (
          Date.now() - new Date(carData.createdAt).getTime() >
          5 * 60 * 1000
        ) {
          await redisService.hSetField(key, "status", "inactive");
          try {
            updateStatusFromServer(carId, "inactive");
          } catch (error) {
            console.error(`[WORKER] : update status error`, error);
          }
          websocketService.broadcast({
            type: "location",
            carId,
            ...carData,
            status: "inactive",
          });
        }
      }
      console.log(`[WORKER] : check car position done`);
    } catch (error) {
      console.error(`[WORKER] : check car position error`, error);
    }
  }, 60000);

  server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  });
}

bootstrap().catch((err) => console.log("[ Error ]:", err));
