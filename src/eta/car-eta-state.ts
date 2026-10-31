// สถานะการคำนวณป้ายถัดไปของรถแต่ละคัน เก็บไว้ใน memory
// ตัวคำนวณต้องใช้ผลครั้งก่อนของรถคันเดิมเสมอ (เช่น รู้ว่ารถอยู่ขาไปหรือขากลับ)
import type { LocalStopProgressState } from "./localStopProgress.ts";
import type { OriginWaitState } from "./originWait.ts";

export type CarEtaState = {
  routeId: string,
  progress: LocalStopProgressState | undefined,
  originWait: OriginWaitState | undefined,
  nextStopPathIndex: number | null,
  nextStopStartedAt: string | null
};

// carId -> สถานะของรถคันนั้น
const statesByCarId = new Map<string, CarEtaState>();

// สถานะล่าสุดของรถคันนี้ (undefined = ยังไม่เคยคำนวณ)
export function getCarEtaState(carId: string): CarEtaState | undefined {
  return statesByCarId.get(carId)
}

// บันทึกสถานะใหม่ของรถคันนี้ ไว้ใช้ตอนตำแหน่งถัดไปมาถึง
export function saveCarEtaState(carId: string, state: CarEtaState): void {
  statesByCarId.set(carId,state)
}

// ลบสถานะของรถคันนี้ (รถ inactive) ครั้งหน้าจะเริ่มคำนวณใหม่
export function clearCarEtaState(carId: string): void {
  statesByCarId.delete(carId)
}