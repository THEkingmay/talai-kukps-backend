// ตรวจว่ารถจอดรอรับคนที่ป้ายแรกของสายหรือไม่ ระหว่างจอดรอจะยังไม่นับ ETA
// 1. รถเข้ารัศมี 30 เมตรของป้ายแรก: จำตำแหน่งตอนนั้นเป็นจุดทดสอบ
// 2. อยู่ห่างจุดทดสอบไม่เกิน 10 เมตรต่อเนื่อง 6 วินาที (ตาม createdAt): ถือว่าจอดรอ
//    ถ้าห่างเกิน แปลว่ารถยังวิ่งเข้าหาที่จอดอยู่ ย้ายจุดทดสอบมาตำแหน่งใหม่
// 3. ระหว่างจอดรอ จุดที่จอดคงที่ ห่างจากจุดนี้เกิน 15 เมตร ถือว่ารถออกแล้ว
//    (ถ้าย้ายตามตำแหน่งล่าสุด รถที่ค่อย ๆ ออกช้า ๆ จะไม่เคยเกินเกณฑ์)
// 4. หลังรถออก ต้องออกนอกรัศมี 30 เมตรก่อน ถึงจะตรวจการจอดรอใหม่ได้
import { distanceInMeters, type LatLng } from './geo.ts';

// รัศมีรอบป้ายแรกที่ถือว่ารถอยู่ที่ต้นทาง
const ORIGIN_RADIUS_METERS = 30;
// ขยับไม่เกินระยะนี้ถือว่ารถนิ่ง (เผื่อ GPS แกว่งตอนจอด)
const STILL_METERS = 10;
// ต้องนิ่งต่อเนื่องนานเท่านี้ถึงจะถือว่าจอดรอ
const STILL_DURATION_MS = 6000;
// ห่างจากจุดที่จอดเกินระยะนี้ถือว่ารถออกแล้ว
const DEPARTURE_METERS = 15;

// สถานะของรถหนึ่งคัน ต้องส่งกลับเข้ามาในการเรียกครั้งถัดไปของรถคันเดิม
// - away: อยู่นอกรัศมีป้ายแรก
// - checking: อยู่ในรัศมี กำลังดูว่านิ่งครบ 6 วินาทีหรือยัง (anchor = จุดทดสอบ)
// - waiting: จอดรออยู่ (anchor = จุดที่จอด)
// - departed: ออกจากที่จอดแล้ว แต่ยังไม่พ้นรัศมี
export type OriginWaitState =
  | { phase: 'away' }
  | { phase: 'checking'; anchor: LatLng; sinceMs: number }
  | { phase: 'waiting'; anchor: LatLng }
  | { phase: 'departed' };

// เวลาของตำแหน่ง (มิลลิวินาที) ใช้ createdAt ถ้ามี ไม่งั้นใช้เวลาตอนนี้
export const getLocationTimeMs = (createdAt?: string | null) => {
  // ไม่มี createdAt ใช้เวลาตอนนี้
  if (!createdAt) {
    return Date.now();
  }

  // แปลงข้อความเวลาเป็นมิลลิวินาที ถ้าอ่านไม่ได้จะได้ NaN
  const timeMs = Date.parse(createdAt);
  if (Number.isNaN(timeMs)) {
    return Date.now();
  }

  return timeMs;
};

// คำนวณสถานะใหม่จากสถานะเดิมและตำแหน่งล่าสุดของรถ
export const updateOriginWait = (
  previous: OriginWaitState | undefined,
  firstStop: LatLng,
  carLocation: LatLng,
  timeMs: number,
): OriginWaitState => {
  // ครั้งแรกยังไม่มีสถานะเดิม ถือว่าอยู่นอกรัศมี
  let state: OriginWaitState = { phase: 'away' };
  if (previous) {
    state = previous;
  }

  const distanceToFirstStop = distanceInMeters(carLocation, firstStop);
  const isNearFirstStop = distanceToFirstStop <= ORIGIN_RADIUS_METERS;

  switch (state.phase) {
    // จอดรออยู่: ห่างจุดที่จอดเกิน 15 เมตร ถือว่ารถออกแล้ว
    case 'waiting': {
      const movedMeters = distanceInMeters(carLocation, state.anchor);
      if (movedMeters > DEPARTURE_METERS) {
        return { phase: 'departed' };
      }
      return state;
    }

    // ออกแล้ว: รอจนพ้นรัศมี ถึงจะกลับไปตรวจใหม่ได้
    case 'departed': {
      if (isNearFirstStop) {
        return state;
      }
      return { phase: 'away' };
    }

    // กำลังตรวจว่ารถนิ่งหรือยัง
    case 'checking': {
      // ออกนอกรัศมีไปแล้ว (วิ่งผ่านโดยไม่จอด)
      if (!isNearFirstStop) {
        return { phase: 'away' };
      }

      // ยังวิ่งอยู่: ย้ายจุดทดสอบมาตำแหน่งนี้ แล้วเริ่มจับเวลาใหม่
      const movedMeters = distanceInMeters(carLocation, state.anchor);
      if (movedMeters > STILL_METERS) {
        return { phase: 'checking', anchor: carLocation, sinceMs: timeMs };
      }

      // นิ่งครบ 6 วินาที: จุดทดสอบกลายเป็นจุดที่จอด
      const stillDurationMs = timeMs - state.sinceMs;
      if (stillDurationMs >= STILL_DURATION_MS) {
        return { phase: 'waiting', anchor: state.anchor };
      }
      return state;
    }

    // อยู่นอกรัศมี: เข้ารัศมีเมื่อไรเริ่มตรวจ
    case 'away': {
      if (isNearFirstStop) {
        return { phase: 'checking', anchor: carLocation, sinceMs: timeMs };
      }
      return state;
    }
  }
};
