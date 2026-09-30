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
import type { NewCarHistoryLog } from "./db/types.ts";
import rateLimit from "express-rate-limit";
import emailService from "./services/email.service.ts";
import s3Service from "./services/s3.service.ts";
import { updateStatusFromServer } from "./modules/cars/cars.service.ts";

const VALID_STATUSES = ["active", "inactive"] as const;

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
        `car:${carId}`,
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

      websocketService.broadcast({
        carId,
        ...data,
      }); // boardcast ไปหา client ทั้งหมด
      redisService.hSet(`car:${carId}`, data); // บันทึกไว้ให้ setTinterval วนมาบันทึก logs ทุก ๆ 60 วินาที
    } catch (error) {
      console.error(
        `[MQTT] Error processing message on topic ${topic}:`,
        error,
      );
    }
  });

  if (process.env.NODE_ENV === "development") {
    app.get("/see-redis", async (req, res) => {
      const data = await redisService.getAllDataInRedis();
      res.json(data);
    });
    app.get("/clear-redis", async (req, res) => {
      await redisService.deleteAll();
      res.json({ message: "Redis cleared" });
    });
  }

  const server = http.createServer(app);
  websocketService.init(server);

  // Save car history logs to the database
  const lastSeenMap = new Map<string, string>(); // carId -> createdAt (ISO
  setInterval(async () => {
    try {
      let data: NewCarHistoryLog[] = [];
      const keys = await redisService.keys("car:*");

      for (const key of keys) {
        const carId = key.replace("car:", "");
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
      const keys = await redisService.keys("car:*");
      for (const key of keys) {
        const carId = key.replace("car:", "");
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
          websocketService.broadcast({ carId, ...carData, status: "inactive" });
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
