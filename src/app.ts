import dotenv from "dotenv";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import redisService from "./services/redis.service.ts";
import mqttService from "./services/mqtt.service.ts";
import websocketService from "./services/websocket.service.ts";

import usersRouter from "./routes/users.route.ts";
import authRouter from "./routes/auth.route.ts";
import http from "http";

dotenv.config();

async function bootstrap() {
    const app: Express = express();

    app.use(
        cors({
            origin: process.env.FRONTEND_URL,
            credentials: true,
        }),
    );
    app.set("trust proxy", 1);
    app.use(cookieParser());

    await redisService.connect(process.env.REDIS_URL!);
    mqttService.connect(process.env.MQTT_URL!, {
        username: process.env.MQTT_SERVER_USERNAME,
        password: process.env.MQTT_SERVER_PASSWORD,
    });
    mqttService.onMessage(async (topic, payload) => {
        try {
            console.log(
                `[MQTT] Message received on topic ${topic}: ${payload}`,
            );

            // ได้รับตำแหฟน่งใหม่แล้วบรรทึกลง redis และให้ websocket broadcast ตำแหน่งใหม่กลับไปยัง client
            // รถต้องส่งข้อมูลมาในรูปแบบ cars/carId = {lat, lng, created_at} สามารถตัดเอา id ของรถได้
            // บันทึกลง redis ในรุปแบบ key car:carid และ value = {lat, lng, created_at}
            // hSet('car:carid', {lat, lng, created_at})
            const data = JSON.parse(payload.toString());
            websocketService.broadcast(data);
            redisService.hSet(`car:${data.carId}`, data); // บันทึกไว้ให้ setTinterval วนมาบันทึก logs ทุก ๆ 60 วินาที
        } catch (error) {
            console.error(
                `[MQTT] Error processing message on topic ${topic}:`,
                error,
            );
        }
    });

    app.use("/users", usersRouter);
    app.use("/auth", authRouter);

    const server = http.createServer(app);
    websocketService.init(server);

    setInterval(async () => {
        // ดึงจาก cars/carid ทุกคันมาบันทึกลง car-history-log
    }, 60000);

    server.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
}

bootstrap().catch((err) => console.log("[ Error ]:", err));
