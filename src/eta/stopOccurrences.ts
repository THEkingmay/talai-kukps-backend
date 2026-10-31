// แปลงจุดบนเส้นทางให้เป็นรายการป้าย ตามลำดับที่รถวิ่งผ่านจริง
// สายที่วิ่งไปแล้ววิ่งกลับ เช่น 1>2>3>4>5>6>3>2>1 จะผ่านป้าย 3 และ 2 สองครั้ง
// แต่ละครั้งที่ผ่าน (occurrence) ใช้เลขป้ายเดิม แต่มี pathIndex ของตัวเอง
import type { Route, RoutePoint } from './types.ts';

// ป้ายหนึ่งครั้งที่รถวิ่งผ่าน
// - sequence: เลขป้ายที่แสดงบนจอ ป้ายเดียวกันได้เลขเดียวกันทุกครั้งที่ผ่าน
// - pathIndex: ตำแหน่งของป้ายใน route.pathPoints ใช้บอกว่าผ่านครั้งไหน
// - timeToNextSecs: เวลาเดินทางจากป้ายนี้ไปป้ายถัดไป (วินาที)
export type LocalRouteStopOccurrence = {
  sequence: number;
  name: string;
  lat: number;
  lng: number;
  pathIndex: number;
  timeToNextSecs: number | null;
};

// ข้อความแทนพิกัด ใช้เทียบว่าเป็นจุดเดียวกันหรือไม่
const toCoordinateKey = (point: { lat: number; lng: number }) => {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
};

// ชื่อจุดที่ตัดช่องว่างหัวท้ายแล้ว จุดที่ไม่มีชื่อได้ข้อความว่าง
const getPointName = (point: RoutePoint) => {
  if (!point.name) {
    return '';
  }
  return point.name.trim();
};

// ตัวระบุว่าเป็นป้ายเดียวกัน: ชื่อป้ายโดยตัดคำว่า "ขาไป"/"ขากลับ" ท้ายชื่อออก
// ถ้าไม่มีชื่อเหลือ ใช้พิกัดแทน
const getStopIdentityKey = (name: string, lat: number, lng: number) => {
  const normalizedName = name
    .replace(/\s*(?:ขาไป|ขากลับ)\s*$/i, '')
    .trim()
    .toLowerCase();

  if (normalizedName === '') {
    return toCoordinateKey({ lat, lng });
  }
  return normalizedName;
};

// รายการป้ายทุกครั้งที่รถผ่าน เรียงตามลำดับบนเส้นทาง
export const getRouteStopOccurrences = (
  route: Route,
): LocalRouteStopOccurrence[] => {
  const sequenceByStopKey = new Map<string, number>();
  const occurrences: LocalRouteStopOccurrence[] = [];

  // ป้ายต้นทาง (จุดแรกที่มีชื่อ) ใช้ตัดป้ายปลายทางที่เป็นจุดเดียวกันออก
  const firstNamedPointIndex = route.pathPoints.findIndex(
    (point) => getPointName(point) !== '',
  );
  let firstStopCoordinate: string | null = null;
  let firstStopKey: string | null = null;
  if (firstNamedPointIndex >= 0) {
    const firstNamedPoint = route.pathPoints[firstNamedPointIndex];
    firstStopCoordinate = toCoordinateKey(firstNamedPoint);
    firstStopKey = getStopIdentityKey(
      getPointName(firstNamedPoint),
      firstNamedPoint.lat,
      firstNamedPoint.lng,
    );
  }

  let previousCoordinate: string | null = null;

  route.pathPoints.forEach((point, pathIndex) => {
    // จุดที่ไม่มีชื่อเป็นแค่เส้นทาง ไม่ใช่ป้าย
    const name = getPointName(point);
    if (name === '') {
      return;
    }

    const coordinateKey = toCoordinateKey(point);
    const stopKey = getStopIdentityKey(name, point.lat, point.lng);

    // เส้นทางเป็นวงรอบ ป้ายปลายทางที่พิกัดหรือชื่อตรงกับต้นทางไม่ต้องนับซ้ำ
    const isAfterFirstStop = pathIndex > firstNamedPointIndex;
    const isSameCoordinateAsFirst =
      firstStopCoordinate !== null && coordinateKey === firstStopCoordinate;
    const isSameStopAsFirst = firstStopKey !== null && stopKey === firstStopKey;
    if (isAfterFirstStop && (isSameCoordinateAsFirst || isSameStopAsFirst)) {
      return;
    }

    // ป้องกันข้อมูลป้ายเดิมซ้ำติดกันใน pathPoints
    if (coordinateKey === previousCoordinate) {
      return;
    }
    previousCoordinate = coordinateKey;

    // ป้ายที่เจอครั้งแรกได้เลขถัดไป ป้ายที่เคยเจอแล้วใช้เลขเดิม
    let sequence = sequenceByStopKey.get(stopKey);
    if (sequence === undefined) {
      sequence = sequenceByStopKey.size + 1;
      sequenceByStopKey.set(stopKey, sequence);
    }

    // เวลาไปป้ายถัดไป: ไม่มีข้อมูลให้เป็น null
    let timeToNextSecs: number | null = null;
    if (point.timeToNextSecs !== undefined && point.timeToNextSecs !== null) {
      timeToNextSecs = point.timeToNextSecs;
    }

    occurrences.push({
      sequence,
      name,
      lat: point.lat,
      lng: point.lng,
      pathIndex,
      timeToNextSecs,
    });
  });

  return occurrences;
};
