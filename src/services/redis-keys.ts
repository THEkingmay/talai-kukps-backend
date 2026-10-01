/**
 * Centralized Redis key factory
 *
 * Key patterns:
 *   session:session:{sessionId}           — user session (hash, TTL 7d)
 *   session:invite:{email}                — admin invite code (hash, TTL จาก admin-invites)
 *   session:resetpassword:{token}         — password reset token (hash, TTL 15m)
 *
 *   car:position:{carId}                  — ตำแหน่งล่าสุดของรถจาก MQTT (hash)
 *   car:activeDriver:{carId}              — driverId ที่กด start อยู่ตอนนี้ (string)
 *   car:alertSent:{carId}                 — flag กัน spam alert กรณีไม่มี driverId เลย (string/bool)
 *
 *   driver:state:{driverId}               — สถานะการขับของคนขับ (string/JSON)
 */

// ─── value interfaces ─────────────────────────────────────────────────────────

import type { MqttMessageType, SessionUserType } from "../types/index.ts";
import type { DriverRedisState } from "../modules/driving-logs/driving-logs.service.ts";

export type {
  SessionUserType as SessionRedisValue,
  MqttMessageType as CarPositionRedisValue,
  DriverRedisState as DriverStateRedisValue,
};

export interface InviteRedisValue {
  inviteCode: string;
}

export interface ResetPasswordRedisValue {
  email: string;
}

// ─── key factories ────────────────────────────────────────────────────────────

export const redisKeys = {
  /** user session — hSet hash */
  session: (sessionId: string) => `session:session:${sessionId}` as const,

  /** admin invite code — hSet hash */
  invite: (email: string) => `session:invite:${email}` as const,

  /** password reset token — hSet hash */
  resetPassword: (token: string) => `session:resetpassword:${token}` as const,

  car: {
    /** ตำแหน่งล่าสุดจาก MQTT — hSet hash, scan ด้วย `car:position:*` */
    position: (carId: string) => `car:position:${carId}` as const,

    /** driverId ที่ active อยู่ตอนนี้ — plain string */
    activeDriver: (carId: string) => `car:activeDriver:${carId}` as const,

    /** flag กัน spam alert กรณีไม่มี driverId — plain bool */
    alertSent: (carId: string) => `car:alertSent:${carId}` as const,

    /** pattern สำหรับ keys() scan ทุก car position */
    positionPattern: "car:position:*" as const,

    /** แปลง key กลับเป็น carId */
    idFromPositionKey: (key: string) => key.replace("car:position:", ""),
  },

  driver: {
    /** สถานะการขับของคนขับ — JSON string */
    state: (driverId: string) => `driver:state:${driverId}` as const,
  },
} as const;
