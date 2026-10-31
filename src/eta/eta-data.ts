// ข้อมูลที่ตัวคำนวณป้ายถัดไปต้องใช้ (สาย + จุดบนเส้นทาง + รถคันไหนอยู่สายไหน)
// โหลดจาก database เก็บไว้ใน memory เพราะตำแหน่งรถมาทุกวินาที จะ query ทุกครั้งไม่ได้
import * as routesService from "../modules/routes/routes.service.ts";
import * as routePointsService from "../modules/route-points/route-points.service.ts";
import * as carsService from "../modules/cars/cars.service.ts";
import type { Route, RoutePoint } from "./types.ts";

// routeId -> สาย พร้อมจุดบนเส้นทาง
let routesById = new Map<string, Route>();
// carId -> routeId ที่ Admin กำหนด (null = ยังไม่กำหนดสาย)
let routeIdByCarId = new Map<string, string | null>();

export async function loadEtaData(): Promise<void> {
  // ดึงทั้ง 3 อย่างพร้อมกัน
  const [routeRows, pointRows, carRows] = await Promise.all([
    routesService.getActiveRoutes(),
    routePointsService.getAll(),
    carsService.getActiveCarRoutes(),
  ]);
  applyEtaData(routeRows, pointRows, carRows);
}

// จัดแถวจาก database ลง Map แยกจาก loadEtaData เพื่อให้เทสต์ส่งข้อมูลเข้ามาเองได้
// โดยไม่ต้องต่อ database
export function applyEtaData(
  routeRows: { id: string; name: string }[],
  pointRows: (RoutePoint & { routeId: string })[],
  carRows: { id: string; routeId: string | null }[],
): void {
  // สายที่ยังไม่ถูกลบ เริ่มด้วยเส้นทางว่าง
  const nextRoutes = new Map<string, Route>();
  for (const route of routeRows) {
    nextRoutes.set(route.id, {
      id: route.id,
      name: route.name,
      pathPoints: [],
    });
  }

  // ใส่จุดลงเส้นทางของสายนั้น (pointRows เรียงตาม sequence มาแล้ว)
  // จุดของสายที่ถูกลบไปแล้วจะหาสายไม่เจอ ให้ข้าม
  for (const pathPoint of pointRows) {
    const route = nextRoutes.get(pathPoint.routeId);
    if (!route) {
      continue;
    }
    route.pathPoints.push(pathPoint);
  }

  const nextCars = new Map<string, string | null>();
  for (const car of carRows) {
    nextCars.set(car.id, car.routeId);
  }

  // สร้างเสร็จแล้วค่อยแทนที่ทีเดียว ระหว่างโหลด ตัวคำนวณยังใช้ข้อมูลชุดเดิมได้
  routesById = nextRoutes;
  routeIdByCarId = nextCars;
}

// สายของรถคันนี้ พร้อมจุดบนเส้นทาง
// คืน null ถ้าไม่รู้จักรถ, รถยังไม่กำหนดสาย หรือสายถูกลบไปแล้ว
export function getRouteForCar(carId: string): Route | null {
  // ไม่รู้จักรถคันนี้ (undefined) หรือยังไม่กำหนดสาย (null)
  const routeId = routeIdByCarId.get(carId);
  if (!routeId) {
    return null;
  }

  // สายถูกลบไปแล้ว
  const route = routesById.get(routeId);
  if (!route) {
    return null;
  }

  return route;
}
