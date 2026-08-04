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

    app.use(
        cors({
            origin: process.env.FRONTEND_URL,
            credentials: true,
        }),
    );
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.set("trust proxy", 1);
    app.use(cookieParser());
    app.use(router);
    app.use(errorMiddleware);
    app.use(limiter);

    await redisService.connect(process.env.REDIS_URL!);
    mqttService.connect(process.env.MQTT_URL!, {
        username: process.env.MQTT_SERVER_USERNAME,
        password: process.env.MQTT_SERVER_PASSWORD,
    });
    mqttService.onMessage(async (topic, payload) => {
        // cars/carId = {status:string , lat:number, lng:number , createdAt:string}
        try {
            console.log(
                `[MQTT] Message received on topic ${topic}: ${payload}`,
            );
            const carId = topic.replace("cars/", "");

            const data: MqttMessageType = JSON.parse(payload.toString());
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

    const server = http.createServer(app);
    websocketService.init(server);

    setInterval(async () => {
        try {
            let data: NewCarHistoryLog[] = [];
            const keys = await redisService.keys("car:*");
            for (const key of keys) {
                const carId = key.replace("car:", "");
                const carData =
                    await redisService.hGetAll<MqttMessageType>(key);
                if (
                    !carData ||
                    carData.lat === undefined ||
                    carData.lng === undefined ||
                    carData.lat === 0 ||
                    carData.lng === 0
                )
                    continue;
                data.push({
                    carId,
                    lat: carData?.lat,
                    lng: carData?.lng,
                    createdAt: new Date(carData?.createdAt),
                });
            }
            if (data.length === 0) return;
            await insertMany(data);
        } catch (error) {
            console.error(`[WORKER] : saving car history log error`, error);
        }
    }, 60000);

    server.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
}

bootstrap().catch((err) => console.log("[ Error ]:", err));
