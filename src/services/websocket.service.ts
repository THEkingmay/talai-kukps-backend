import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { Request } from "express";
import type { WebSocketLocationBroadcastType } from "../types/index.ts";

const MAX_CONNECTIONS = 500; // จำนวน connection รวมสูงสุดของ Server

interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  ip: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;

  init(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws: CustomWebSocket, req: Request) => {
      // ตรวจสอบ total connection ก่อนรับเข้า
      if (this.wss!.clients.size > MAX_CONNECTIONS) {
        console.warn(
          `[WebSocket] Server at capacity (${MAX_CONNECTIONS}). Rejecting new connection.`,
        );
        ws.close(1008, "Server is at capacity");
        return;
      }

      ws.isAlive = true;
      // ดึง IP จาก x-forwarded-for (เมื่ออยู่หลัง proxy) หรือจาก socket โดยตรง
      ws.ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown";

      console.log(
        `✅ [WebSocket] Client connected (${ws.ip}) — Total: ${this.wss!.clients.size}`,
      );

      ws.on("close", () => {
        console.log(
          `❌ [WebSocket] Client disconnected (${ws.ip}) — Total: ${this.wss!.clients.size}`,
        );
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

  // ไว้ส่งตำแหน่งรถปัจจุบันไปยัง client ทุกคน
  // ถูกเรียกจาก mqtt subscriber ให้ broadcast ข้อมูลตำแหน่งรถปัจจุบันไปยัง client ทุกคน
  broadcast(data: WebSocketLocationBroadcastType) {
    if (!this.wss) return;
    const payload = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      // ส่งเฉพาะ Client ที่สถานะยังเปิดอยู่ (READYSTATE = 1)
      console.log("Boardcast data", data);
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
            `[WebSocket] Terminating dead connection (${wsClient.ip ?? "Unknown"})`,
          );
          wsClient.terminate(); // ตัดสาย wsClient ที่ไม่ตอบกลับ Pong
          continue;
        }
        wsClient.isAlive = false;
        wsClient.ping(); // ส่ง Ping ไปหา Client
      }
    }, 30000); // เช็คทุกๆ 30 วินาที
  }
}

export default new WebSocketService();
