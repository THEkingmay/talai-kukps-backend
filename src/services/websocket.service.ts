import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Request } from "express";
import type { WebSocketLocationBroadcastType } from "../types/index.ts";

interface CustomWebSocket extends WebSocket {
    isAlive: boolean;
    ip: string | undefined;
}

class WebSocketService {
    private wss: WebSocketServer | null = null;

    private ipConnectionCount = new Map<string, number>();
    init(server: Server) {
        this.wss = new WebSocketServer({ server });
        this.wss.on("connection", (ws: CustomWebSocket, req: Request) => {
            ws.isAlive = true;
            const ip = ws.ip;
            if (!ip) return;

            const currentCount = this.ipConnectionCount.get(ip) || 0;

            if (currentCount >= 5) {
                // ห้าม 1 IP ต่อเกิน 5 สาย
                console.warn(`[WebSocket] IP ${ip} exceeded connection limit.`);
                ws.close(1008, "Too many connections from this IP");
                return;
            }

            this.ipConnectionCount.set(ip, currentCount + 1);

            ws.on("close", () => {
                console.log(
                    `❌ [WebSocket] Client disconnected (${ws.ip || "Anonymous"})`,
                );
                this.ipConnectionCount.set(ip, currentCount - 1);
            });
            ws.on("error", (err) => {
                console.error("⚠️ [WebSocket Error]:", err.message);
            });

            // ดักจับ Pong ตอบกลับจาก Client (สำหรับ Heartbeat)
            ws.on("pong", () => {
                ws.isAlive = true;
            });
        });
        this.setupHeartbeat();
    }

    // ไว้ส่งตำแหน่งรถปัจจบันไปยัง client ทุกคน
    // ถุกเรียกจาก mqtt subscriber ให้ broadcast ข้อมูลตำแหน่งรถปัจจบันไปยัง client ทุกคน
    broadcast(data: WebSocketLocationBroadcastType) {
        if (!this.wss) return;
        const payload = JSON.stringify(data);
        this.wss.clients.forEach((client) => {
            // ส่งเฉพาะ Client ที่สถานะยังเปิดอยู่ (READYSTATE = 1)
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }
    private setupHeartbeat() {
        setInterval(() => {
            if (!this.wss) return;
            for (const client of this.wss.clients) {
                const wsClient = client as CustomWebSocket;
                if (wsClient.isAlive === false) {
                    console.log(
                        `[WebSocket] Terminating dead connection (${wsClient.ip || "Unknown"})`,
                    );
                    return wsClient.terminate(); // ตัดสาย wsClient ที่ไม่ตอบกลับ Pong
                }

                wsClient.isAlive = false;
                wsClient.ping(); // ส่ง Ping ไปหา Client
            }
        }, 30000); // เช็คทุกๆ 30 วินาที
    }
}

export default new WebSocketService();
