// คำนวณป้ายถัดไปของรถหนึ่งคัน ทุกครั้งที่ได้ตำแหน่งใหม่จาก MQTT
// รวมทุกขั้นไว้ที่เดียว: หาสาย → อ่าน state เดิม → เช็กจอดรอ → คำนวณ → บันทึก state
import { getRouteForCar } from "./eta-data.ts";
import { getCarEtaState, saveCarEtaState, clearCarEtaState } from "./car-eta-state.ts";
import { calculateLocalNextStop } from "./localStopProgress.ts";
import { updateOriginWait, getLocationTimeMs } from "./originWait.ts";
import { getRouteStopOccurrences } from "./stopOccurrences.ts";

// ผลที่ส่งให้แอปพร้อมตำแหน่งรถ
export type CarEtaResult = {
  nextStopPathIndex: number | null;
  originWaiting: boolean;
  nextStopStartedAt: string | null;
};

// ผลตอนที่ไม่รู้ป้ายถัดไป (รถไม่มีสาย หรืออยู่นอกเส้นทาง)
const NO_ETA: CarEtaResult = {
  nextStopPathIndex: null,
  originWaiting: false,
  nextStopStartedAt: null,
};

export function updateCarEta(
  carId: string,
  location: { lat: number; lng: number; createdAt: string },
): CarEtaResult {
  // ① สายของรถคันนี้
  const route = getRouteForCar(carId);
  // TODO 1: ถ้าไม่มีสาย → ลบ state ของรถคันนี้ แล้วคืน NO_ETA
  if (!route) {
    clearCarEtaState(carId);
    return NO_ETA
  }

  // ② state ครั้งก่อน ใช้ได้เฉพาะเมื่อยังเป็นสายเดิม (Admin อาจย้ายรถไปสายอื่น)
  let previous = getCarEtaState(carId);
  // TODO 2: ถ้า previous มีค่า และ previous.routeId ไม่เท่ากับ route.id → ให้ previous = undefined
  if (previous && previous.routeId !== route.id) {
    previous = undefined
  }

  const carLocation = { lat: location.lat, lng: location.lng };

  // ③ จอดรอที่ป้ายแรกหรือไม่ (สายที่ไม่มีป้าย ไม่ต้องเช็ก)
  const firstStop = getRouteStopOccurrences(route)[0];
  let originWait = previous?.originWait;
  let originWaiting = false;
  if (firstStop) {
    originWait = updateOriginWait(
      originWait,
      firstStop,
      carLocation,
      getLocationTimeMs(location.createdAt),
    );
    originWaiting = originWait.phase === "waiting";
  }

  // ④ ป้ายถัดไป
  const result = calculateLocalNextStop(route, carLocation, previous?.progress);
  if (!result) {
    saveCarEtaState(carId, { routeId: route.id, progress: undefined, originWait: originWait, nextStopPathIndex: null, nextStopStartedAt: null })
    return NO_ETA
  }
  // TODO 3: ถ้า result เป็น null (รถอยู่นอกเส้นทาง)
  //         → บันทึก state: routeId = route.id, progress = undefined, originWait = originWait,
  //           nextStopPathIndex = null, nextStopStartedAt = null
  //         → แล้วคืน NO_ETA

  // ⑤ เวลาที่ป้ายถัดไปเปลี่ยน (ใช้ตามตารางกฎ 3 ข้อ)
  let nextStopStartedAt: string | null = location.createdAt;
  // TODO 4: ถ้าจอดรอ → null
  //         ถ้าไม่ได้จอดรอ และ previous มีค่า และ previous.nextStopPathIndex เท่ากับ result.nextStopPathIndex
  //         และ previous.nextStopStartedAt ไม่ใช่ null → ใช้ previous.nextStopStartedAt
  if (originWaiting) {
    nextStopStartedAt = null
  } else if (!originWaiting && previous && previous.nextStopPathIndex === result.nextStopPathIndex && previous.nextStopStartedAt) {
    nextStopStartedAt = previous.nextStopStartedAt
  }

  // ⑥ บันทึก state ไว้ใช้ครั้งหน้า
  // TODO 5: saveCarEtaState(carId, { ... ครบ 5 field ... })
  saveCarEtaState(carId, {
    routeId: route.id,
    progress: result.state,
    originWait: originWait,
    nextStopPathIndex: result.nextStopPathIndex,
    nextStopStartedAt: nextStopStartedAt
  })

  return {
    nextStopPathIndex: result.nextStopPathIndex,
    originWaiting,
    nextStopStartedAt,
  };
}

export function getCarEtaResult(carId: string): CarEtaResult {
  const state = getCarEtaState(carId);
  if (!state) {
    return NO_ETA;
  }

  let originWaiting = false;

  if (state.originWait && state.originWait.phase === "waiting") {
    originWaiting = true;
  }

  return {
    nextStopPathIndex: state.nextStopPathIndex,
    originWaiting,
    nextStopStartedAt: state.nextStopStartedAt
  };
}