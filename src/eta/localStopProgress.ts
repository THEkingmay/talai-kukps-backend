// =============================================================================
// หาป้ายถัดไปของรถ จากตำแหน่ง GPS ของรถ
// =============================================================================
// ใช้ทุกครั้งที่ได้ตำแหน่งใหม่ของรถแต่ละคันจาก MQTT ทำงาน 2 ขั้น:
//
// ขั้นที่ 1: หาว่ารถอยู่ตรงไหนของเส้นทาง (findNearestPathIndex)
//   - เส้นทาง = จุด pathPoints ที่ Admin วาด ต่อกันเป็นเส้น (segment)
//     segment ที่ i คือเส้นจาก pathPoints[i] ไป pathPoints[i + 1]
//   - ตำแหน่งบนเส้นทางเก็บเป็น pathProgress = i + t
//     เช่น 12.5 = อยู่กลาง segment ที่ 12 (ระหว่างจุด 12 กับ 13)
//   - ใช้สถานะครั้งก่อน (previousState) ช่วยตัดสิน เพราะเส้นทางจริงมีช่วงที่
//     ขาไปกับขากลับใช้ถนนเดียวกัน ดูแค่ระยะทางอย่างเดียวจะเลือกขาผิด
//
// ขั้นที่ 2: เลือกป้ายถัดไป (calculateLocalNextStop)
//   - ป้ายแรกที่อยู่ข้างหน้า pathProgress ของรถ
//   - ถ้ารถอยู่ห่างป้ายนั้นไม่เกิน 5 เมตร ถือว่าถึงแล้ว ใช้ป้ายถัดจากนั้น
//
// ผลลัพธ์มี state ที่ต้องส่งกลับเข้ามาในการเรียกครั้งถัดไปของรถคันเดิมเสมอ
// =============================================================================
import type { Route } from './types.ts';
import { distanceInMeters, toLocalMeters, type LatLng } from './geo.ts';
import {
  getRouteStopOccurrences,
  type LocalRouteStopOccurrence,
} from './stopOccurrences.ts';

// -----------------------------------------------------------------------------
// ค่าที่ใช้ตัดสิน (ตั้งจากข้อมูลเส้นทางจริงของสายหน้ามอและสายหอใน)
// -----------------------------------------------------------------------------

// รถห่างเส้นทางเกินระยะนี้ ไม่ถือว่าวิ่งอยู่บนสายนี้ (ไม่แสดงรถและไม่คำนวณป้าย)
export const MAX_ROUTE_DISTANCE_METERS = 100;

// รถห่างป้ายไม่เกินระยะนี้ ถือว่าถึงป้ายแล้ว
const STOP_ARRIVAL_RADIUS_METERS = 5;

// ช่วงค้นหารอบตำแหน่งเดิม นับเป็นจำนวน segment: ถอยหลังได้ 4 เดินหน้าได้ 12
// กันไม่ให้ตำแหน่งกระโดดไปถนนช่วงอื่นที่อยู่ใกล้กันแต่ไม่ต่อจากตำแหน่งเดิม
const PATH_BACKTRACK_TOLERANCE = 4;
const PATH_FORWARD_LOOKAHEAD = 12;

// ต้นทางกับปลายทางเป็นจุดเดียวกัน: ตำแหน่งแรกที่ห่างต้นทางไม่เกินระยะนี้
// และตรงกับช่วงท้ายเส้นทาง ให้ถือว่าอยู่ต้นเส้นทาง (เริ่มรอบใหม่) ไว้ก่อน
const START_END_AMBIGUITY_RADIUS_METERS = 80;

// ใช้ทิศที่รถวิ่งแยกขาไปกับขากลับที่ใช้ถนนเดียวกัน:
// - segment ที่ห่างกว่า segment ที่ใกล้ที่สุดไม่เกินระยะนี้ ยังเป็นตัวเลือกได้
const HEADING_AMBIGUITY_METERS = 15;
// - รถต้องเคลื่อนที่อย่างน้อยระยะนี้ก่อนจะวัดทิศได้ (กัน GPS แกว่ง)
const MIN_HEADING_MOVE_METERS = 10;
// - เคลื่อนที่เกินระยะนี้ระหว่างสองตำแหน่ง ทิศที่วัดได้เชื่อถือไม่ได้
//   (เช่น ตำแหน่งแรกจาก API เก่าไปแล้ว)
const MAX_HEADING_MOVE_METERS = 100;
// - ทิศของ segment ต้องเบนจากทิศที่รถวิ่งไม่เกิน 60° (cos 60° = 0.5)
const MIN_HEADING_ALIGNMENT = 0.5;
// จะใช้ทิศทางข้ามไปช่วงต้นเส้นทาง (เริ่มรอบใหม่) ได้ รถต้องเคลื่อนที่อย่างน้อยระยะนี้
// GPS ที่แกว่งตอนรถจอดนิ่งอาจกระโดดเกิน 10 เมตรในทิศใดก็ได้
const MIN_WRAP_MOVE_METERS = 20;
// ตำแหน่งบนเส้นทางเดินหน้าได้ไม่เกิน 1.5 เท่าของระยะที่รถเคลื่อนที่ + 15 เมตร
// (เผื่อทางโค้งที่ระยะตามถนนยาวกว่าระยะเส้นตรง และ GPS คลาดเคลื่อน)
const MAX_PATH_ADVANCE_FACTOR = 1.5;
const PATH_ADVANCE_SLACK_METERS = 15;
// ถอยหลังตามเส้นทางได้ไม่เกินระยะนี้ (เผื่อ GPS แกว่ง) รถไม่ได้วิ่งถอยหลัง
// ถ้าไม่จำกัด หลังกลับรถที่ต้นทาง ตำแหน่งจะไหลถอยไปตามขากลับที่ใช้ถนนเดียวกัน
const MAX_PATH_BACKTRACK_METERS = 15;
// รถอยู่ห่างตำแหน่งที่คิดว่าอยู่เกินระยะนี้ แปลว่าเลือกขาผิด (เช่น เริ่มติดตามรถตรงช่วง
// ที่ขาไปกับขากลับทับกันทั้งตำแหน่งและทิศทาง) ให้หาตำแหน่งใหม่จากทั้งเส้นทาง
const LOST_DISTANCE_METERS = 30;
// ออกจากต้นทาง (กลับรถที่ป้ายแรก): ถ้ารถเคยเข้าใกล้ต้นทางไม่เกิน 60 เมตรตอนท้ายรอบ
// แล้วห่างออกไปอีก 5 เมตร และอยู่บนเส้นต้นรอบ ให้นับเป็นรอบใหม่ทันที
const TERMINAL_RADIUS_METERS = 60;
const TERMINAL_DEPARTURE_METERS = 5;
const TERMINAL_MATCH_MARGIN_METERS = 5;

// -----------------------------------------------------------------------------
// ชนิดข้อมูล
// -----------------------------------------------------------------------------

// สถานะของรถหนึ่งคัน ต้องส่งกลับเข้ามาในการคำนวณครั้งถัดไปของรถคันเดิม
export type LocalStopProgressState = {
  routeId: string;
  // segment ที่รถอยู่: เส้นจาก pathPoints[pathIndex] ไป pathPoints[pathIndex + 1]
  pathIndex: number;
  // ตำแหน่งบนเส้นทาง = pathIndex + สัดส่วนที่วิ่งไปแล้วใน segment (0 ถึง 1)
  pathProgress: number;
  // ป้ายถัดไปที่คำนวณได้ครั้งล่าสุด (pathIndex ของป้าย)
  nextStopPathIndex: number;
  // รู้ทิศที่รถวิ่งแล้วหรือยัง และจุดเริ่มที่ใช้วัดทิศ (ย้ายทุกครั้งที่รถวิ่งไปได้ 20 เมตร)
  headingConfirmed: boolean;
  headingAnchor: LatLng;
  // ตำแหน่ง GPS ตอนที่ตำแหน่งบนเส้นทางเปลี่ยนครั้งล่าสุด ใช้จำกัดว่าเดินหน้าได้แค่ไหน
  // ถ้าตำแหน่งบนเส้นทางค้างอยู่ ระยะที่อนุญาตจะเพิ่มตามระยะที่รถเคลื่อนที่จริง
  progressLocation: LatLng;
  // ตำแหน่งที่ไกลที่สุดที่รถเคยไปถึงในรอบนี้ ใช้จำกัดการถอยหลัง
  peakProgress: number;
  // ระยะที่ใกล้ต้นทางที่สุดตอนท้ายรอบ ใช้ดูว่ารถกลับรถออกจากต้นทางแล้วหรือยัง
  closestToStartMeters: number;
};

// ผลลัพธ์ที่ส่งให้หน้าจอ
export type LocalNextStopResult = {
  nextStopSequence: number;
  nextStopPathIndex: number;
  state: LocalStopProgressState;
};

// ผลของขั้นที่ 1 (ตำแหน่งบนเส้นทางและสถานะที่ใช้ในครั้งถัดไป)
type PathMatch = Pick<
  LocalStopProgressState,
  | 'pathIndex'
  | 'pathProgress'
  | 'peakProgress'
  | 'headingConfirmed'
  | 'headingAnchor'
  | 'progressLocation'
  | 'closestToStartMeters'
>;

// ทิศที่รถเคลื่อนที่ เป็นเมตร (x = ตะวันออก, y = เหนือ)
type Movement = { x: number; y: number };

// รถเทียบกับ segment หนึ่ง: index ของ segment, ตำแหน่งบนเส้น t (0 ถึง 1)
// และระยะจากรถถึงเส้น
type SegmentMatch = { index: number; t: number; distance: number };

// -----------------------------------------------------------------------------
// เครื่องมือพื้นฐาน
// -----------------------------------------------------------------------------

// แปลง pathProgress เป็นระยะทางตามเส้นทาง (เมตร) นับจากจุดแรก
// total คือระยะทั้งรอบ รวมช่วงจากจุดสุดท้ายกลับมาจุดแรก
const createMetersAlongPath = (route: Route) => {
  const { pathPoints } = route;
  // cumulative[i] = ระยะตามเส้นทางจากจุด 0 ถึงจุด i
  const cumulative = [0];
  for (let index = 1; index < pathPoints.length; index += 1) {
    cumulative.push(
      cumulative[index - 1] +
        distanceInMeters(pathPoints[index - 1], pathPoints[index]),
    );
  }
  const last = pathPoints.length - 1;
  const toMeters = (progress: number) => {
    const index = Math.min(Math.floor(progress), last);
    const next = Math.min(index + 1, last);
    return (
      cumulative[index] +
      (progress - index) * (cumulative[next] - cumulative[index])
    );
  };
  toMeters.total =
    cumulative[last] + distanceInMeters(pathPoints[last], pathPoints[0]);
  return toMeters;
};

// ข้อมูลที่ขึ้นกับเส้นทางอย่างเดียว คำนวณครั้งเดียวต่อสาย ไม่ต้องคำนวณใหม่ทุกตำแหน่ง
// (โหลดข้อมูลสายใหม่จะได้ object ใหม่ จึงคำนวณใหม่เอง)
type RouteGeometry = {
  stops: LocalRouteStopOccurrence[];
  metersAlong: ReturnType<typeof createMetersAlongPath>;
};
const routeGeometryCache = new WeakMap<Route, RouteGeometry>();
const getRouteGeometry = (route: Route): RouteGeometry => {
  let geometry = routeGeometryCache.get(route);
  if (!geometry) {
    geometry = {
      // ป้ายตามลำดับที่รถวิ่งผ่าน (ป้ายที่ผ่านซ้ำมีหลายรายการ คนละ pathIndex)
      stops: getRouteStopOccurrences(route),
      metersAlong: createMetersAlongPath(route),
    };
    routeGeometryCache.set(route, geometry);
  }
  return geometry;
};

// index ของ segment สุดท้าย (จุดสุดท้าย - 1)
const getLastSegmentIndex = (route: Route) =>
  Math.max(0, route.pathPoints.length - 2);

// พิกัดของตำแหน่ง t (0 ถึง 1) บน segment ที่ index
const pointOnSegment = (route: Route, index: number, t: number): LatLng => {
  const { pathPoints } = route;
  const from = pathPoints[index];
  const to = pathPoints[Math.min(index + 1, pathPoints.length - 1)];
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
};

// index ของทุก segment บนเส้นทาง: [0, 1, ..., segment สุดท้าย]
const allSegmentIndexes = (route: Route) =>
  Array.from({ length: getLastSegmentIndex(route) + 1 }, (_, index) => index);

// ฉายตำแหน่งรถลงบน segment: ได้ระยะจากรถถึงเส้น และตำแหน่งบนเส้น (t)
// ใช้ segment แทนจุด เพราะจุดบนเส้นทางห่างกันได้หลายร้อยเมตร
const matchSegment = (
  route: Route,
  carLocation: LatLng,
  index: number,
): SegmentMatch => {
  const { pathPoints } = route;
  // ให้รถเป็นจุด (0, 0) แล้วหาจุดบนเส้น start -> end ที่ใกล้ (0, 0) ที่สุด
  const start = toLocalMeters(carLocation, pathPoints[index]);
  const end = toLocalMeters(
    carLocation,
    pathPoints[Math.min(index + 1, pathPoints.length - 1)],
  );
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;

  // t = ตำแหน่งบนเส้นที่ใกล้รถที่สุด (0 = จุดเริ่ม, 1 = จุดปลาย)
  // segment ที่ยาว 0 (สองจุดซ้อนกัน) ใช้ t = 0
  let t = 0;
  if (lengthSquared !== 0) {
    const projection =
      (-start.x * segmentX - start.y * segmentY) / lengthSquared;
    // จำกัดให้อยู่บนเส้น ไม่เลยปลายทั้งสองข้าง
    t = Math.max(0, Math.min(1, projection));
  }

  // ระยะจากรถ (0, 0) ถึงจุดบนเส้นที่ตำแหน่ง t
  const closestX = start.x + segmentX * t;
  const closestY = start.y + segmentY * t;
  const distance = Math.hypot(closestX, closestY);

  return { index, t, distance };
};

// ฉายตำแหน่งรถลงบนทุก segment ครั้งเดียวต่อตำแหน่ง ผลที่ index i คือ segment ที่ i
// ฟังก์ชันอื่นหยิบผลจาก array นี้ไปใช้ ไม่ต้องคำนวณซ้ำ
const matchAllSegments = (route: Route, carLocation: LatLng) => {
  if (route.pathPoints.length === 0) {
    return [];
  }

  const matches: SegmentMatch[] = [];
  for (const index of allSegmentIndexes(route)) {
    matches.push(matchSegment(route, carLocation, index));
  }
  return matches;
};

// เงื่อนไขกรองผลการเทียบ segment (ใช้กับ findClosestSegment และ
// pickHeadingAlignedSegment) ค่าเริ่มต้นรับทุก segment
type AcceptMatch = (match: SegmentMatch) => boolean;
const acceptAll: AcceptMatch = () => true;

// segment ที่ใกล้รถที่สุดจาก index ที่ให้มา (เฉพาะที่ผ่านเงื่อนไข accept)
// ไม่ส่ง indexes = ค้นหาจากทั้งเส้นทาง
const findClosestSegment = (
  matches: SegmentMatch[],
  indexes: Iterable<number> = matches.keys(),
  accept: AcceptMatch = acceptAll,
): SegmentMatch | null => {
  let closest: SegmentMatch | null = null;
  for (const index of indexes) {
    const match = matches[index];
    if (!accept(match)) {
      continue;
    }
    if (closest === null || match.distance < closest.distance) {
      closest = match;
    }
  }
  return closest;
};

// ระยะที่สั้นที่สุดจากรถถึงเส้นทาง ใช้ตัดสินว่ารถอยู่บนสายนี้หรือไม่
// คืน null ถ้าเส้นทางไม่มีจุด
export const getDistanceToRouteMeters = (route: Route, carLocation: LatLng) => {
  const matches = matchAllSegments(route, carLocation);
  const closest = findClosestSegment(matches);
  if (closest === null) {
    return null;
  }
  return closest.distance;
};

// ทิศของ segment ตรงกับทิศที่รถวิ่งแค่ไหน (cos ของมุมระหว่างกัน)
// 1 = ทิศเดียวกัน, 0 = ตั้งฉาก, -1 = สวนทาง
const getSegmentAlignment = (
  route: Route,
  index: number,
  movement: Movement,
) => {
  const { pathPoints } = route;
  const from = pathPoints[index];
  const to = pathPoints[Math.min(index + 1, pathPoints.length - 1)];
  const segment = toLocalMeters(from, to);
  const segmentLength = Math.hypot(segment.x, segment.y);
  const movementLength = Math.hypot(movement.x, movement.y);
  if (segmentLength === 0 || movementLength === 0) {
    return -1;
  }

  return (
    (segment.x * movement.x + segment.y * movement.y) /
    (segmentLength * movementLength)
  );
};

// เลือก segment ที่ใกล้รถ และมีทิศตรงกับทิศที่รถวิ่ง
// เช่น ขาไปกับขากลับห่างกันไม่กี่เมตร จะได้ขาที่วิ่งไปทางเดียวกับรถ
// คืน null ถ้าไม่มี segment ไหนที่ทิศตรงกัน
const pickHeadingAlignedSegment = (
  route: Route,
  matches: SegmentMatch[],
  indexes: Iterable<number>,
  movement: Movement,
  accept: AcceptMatch = acceptAll,
) => {
  const candidates = Array.from(indexes, (index) => matches[index]).filter(
    accept,
  );
  if (candidates.length === 0) {
    return null;
  }
  const closestDistance = Math.min(
    ...candidates.map((match) => match.distance),
  );

  let best: SegmentMatch | null = null;
  for (const match of candidates) {
    if (
      match.distance <= closestDistance + HEADING_AMBIGUITY_METERS &&
      (!best || match.distance < best.distance) &&
      getSegmentAlignment(route, match.index, movement) >= MIN_HEADING_ALIGNMENT
    ) {
      best = match;
    }
  }
  return best;
};

// ตำแหน่งแรกของรถ (ยังไม่มีสถานะเดิม): ใช้ segment ที่ใกล้ที่สุดไปก่อน
// ยกเว้นตอนอยู่ใกล้ต้นทางแต่ segment ที่ใกล้ที่สุดเป็นช่วงท้าย ให้ถือว่าเริ่มรอบใหม่
const getInitialSegment = (
  route: Route,
  carLocation: LatLng,
  matches: SegmentMatch[],
  closest: SegmentMatch,
): SegmentMatch => {
  const isNearStartPoint =
    distanceInMeters(carLocation, route.pathPoints[0]) <=
    START_END_AMBIGUITY_RADIUS_METERS;

  // segment ที่ใกล้ที่สุดอยู่ 25% ท้ายเส้นทาง
  const isClosestNearEnd = closest.index >= getLastSegmentIndex(route) * 0.75;

  if (isClosestNearEnd && isNearStartPoint) {
    return matches[0];
  }
  return closest;
};

// segment ที่จะค้นหาในครั้งนี้:
// - contiguous: รอบตำแหน่งเดิม (ถอยหลัง 4 ถึงเดินหน้า 12 segment)
// - wrapped: ช่วงต้นเส้นทาง เพิ่มเข้ามาเมื่อรถใกล้ครบรอบ เพื่อให้วนไปรอบใหม่ได้
const getSearchWindow = (
  route: Route,
  previousPathIndex: number,
  closestIndex: number,
) => {
  const lastSegmentIndex = getLastSegmentIndex(route);
  // ช่วงต่อเนื่องจากตำแหน่งเดิม และช่วงต้นเส้นทางที่เพิ่มเข้ามาเมื่อใกล้ครบรอบ
  const contiguous: number[] = [];
  const wrapped: number[] = [];

  const firstIndex = Math.max(0, previousPathIndex - PATH_BACKTRACK_TOLERANCE);
  const lastIndex = Math.min(
    lastSegmentIndex,
    previousPathIndex + PATH_FORWARD_LOOKAHEAD,
  );
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    contiguous.push(index);
  }

  // ใกล้ครบรอบ: ตำแหน่งเดิมอยู่ 25% ท้าย และ segment ที่ใกล้ที่สุดอยู่ 25% แรก
  const isCompletingLoop =
    previousPathIndex >= lastSegmentIndex * 0.75 &&
    closestIndex <= lastSegmentIndex * 0.25;

  // จำนวน segment ช่วงต้นที่จะเพิ่ม: 12 ถ้าใกล้ครบรอบ ไม่งั้นเท่าที่ช่วงค้นหา
  // เลยปลายเส้นทางไป (ติดลบ = ไม่เพิ่ม)
  let overflow = previousPathIndex + PATH_FORWARD_LOOKAHEAD - lastSegmentIndex;
  if (isCompletingLoop) {
    overflow = PATH_FORWARD_LOOKAHEAD;
  }
  const loopEnd = Math.min(lastSegmentIndex, overflow);
  for (let index = 0; index <= loopEnd; index += 1) {
    // ไม่เพิ่ม segment ที่อยู่ในช่วงต่อเนื่องแล้ว
    if (index < firstIndex) {
      wrapped.push(index);
    }
  }

  return { contiguous, wrapped };
};

// ไม่รู้ทิศทาง: อยู่บนช่วงต่อเนื่องจากตำแหน่งเดิมไว้ก่อน จะข้ามไปช่วงต้นเส้นทาง
// (เริ่มรอบใหม่) ก็ต่อเมื่อช่วงต้นใกล้กว่าชัดเจน เพราะขาไปกับขากลับอาจใช้ถนนเดียวกัน
const pickContinuousSegment = (
  matches: SegmentMatch[],
  window: { contiguous: number[]; wrapped: number[] },
  accept: AcceptMatch,
) => {
  const contiguous = findClosestSegment(matches, window.contiguous, accept);
  const wrapped = findClosestSegment(matches, window.wrapped, accept);
  if (contiguous === null) {
    return wrapped;
  }
  if (wrapped === null) {
    return contiguous;
  }

  // ข้ามไปช่วงต้นเส้นทาง เฉพาะเมื่อใกล้กว่าช่วงต่อเนื่องเกิน 15 เมตร
  if (wrapped.distance + HEADING_AMBIGUITY_METERS < contiguous.distance) {
    return wrapped;
  }
  return contiguous;
};

// ค่าที่ส่งให้ toPathMatch (ค่าที่มี ? ไม่ต้องส่งก็ได้)
type PathMatchOptions = {
  headingConfirmed: boolean;
  headingAnchor: LatLng;
  peakProgress?: number;
  progressLocation?: LatLng;
  closestToStartMeters?: number;
};

// รวมผลการเทียบ segment กับสถานะอื่น ๆ เป็น PathMatch
// ค่าที่ไม่ได้ส่งมา: peakProgress = ตำแหน่งปัจจุบัน, progressLocation = headingAnchor
// และ closestToStartMeters = ไม่มี (Infinity)
const toPathMatch = (
  match: SegmentMatch,
  options: PathMatchOptions,
): PathMatch => {
  const progress = match.index + match.t;

  let peakProgress = progress;
  if (options.peakProgress !== undefined) {
    peakProgress = options.peakProgress;
  }

  let progressLocation = options.headingAnchor;
  if (options.progressLocation !== undefined) {
    progressLocation = options.progressLocation;
  }

  let closestToStartMeters = Number.POSITIVE_INFINITY;
  if (options.closestToStartMeters !== undefined) {
    closestToStartMeters = options.closestToStartMeters;
  }

  return {
    pathIndex: match.index,
    pathProgress: progress,
    peakProgress,
    headingConfirmed: options.headingConfirmed,
    headingAnchor: options.headingAnchor,
    progressLocation,
    closestToStartMeters,
  };
};

// -----------------------------------------------------------------------------
// ขั้นที่ 1: หาว่ารถอยู่ตรงไหนของเส้นทาง
// -----------------------------------------------------------------------------
// ลำดับการตัดสิน:
//   ก. ตำแหน่งแรก (ไม่มีสถานะเดิม หรือเปลี่ยนสาย) -> segment ที่ใกล้ที่สุด
//   ข. ยังไม่รู้ทิศทาง -> พอรถวิ่งได้ 10 เมตร หา segment ที่ทิศตรงกันจากทั้งเส้นทาง
//   ค. รถเพิ่งกลับรถออกจากต้นทาง -> ไปรอบใหม่ทันที
//   ง. ปกติ -> ค้นหาเฉพาะรอบตำแหน่งเดิม เลือก segment ที่ทิศตรงกันก่อน
//      ถ้าไม่มี เลือก segment ต่อเนื่องที่ใกล้ที่สุด ถ้าไม่มีอีก ค้างตำแหน่งเดิมไว้
//      (ทุกตัวเลือกต้องไม่เดินหน้าเกินระยะที่รถวิ่งจริง และไม่ถอยหลังเกิน 15 เมตร)
//   จ. ถ้าผลที่ได้ห่างรถเกิน 30 เมตร แปลว่าหลงขา -> หาใหม่จากทั้งเส้นทาง
const findNearestPathIndex = (
  route: Route,
  carLocation: LatLng,
  matches: SegmentMatch[],
  closest: SegmentMatch,
  previousState?: LocalStopProgressState,
): PathMatch => {
  // ก. ตำแหน่งแรกของรถ หรือเปลี่ยนสาย
  if (!previousState || previousState.routeId !== route.id) {
    return toPathMatch(
      getInitialSegment(route, carLocation, matches, closest),
      {
        headingConfirmed: false,
        headingAnchor: carLocation,
      },
    );
  }

  // ทิศและระยะที่รถเคลื่อนที่ นับจากจุดเริ่มวัดทิศ (headingAnchor)
  const anchor = previousState.headingAnchor;
  const movement = toLocalMeters(anchor, carLocation);
  const movedMeters = Math.hypot(movement.x, movement.y);
  const hasMovedEnough =
    movedMeters >= MIN_HEADING_MOVE_METERS &&
    movedMeters <= MAX_HEADING_MOVE_METERS;

  // ข. ยังไม่รู้ทิศทาง
  if (!previousState.headingConfirmed) {
    // ตำแหน่งกระโดดไกลเกินไป (เช่น ตำแหน่งแรกเก่าไปแล้ว) เริ่มนับใหม่
    if (movedMeters > MAX_HEADING_MOVE_METERS) {
      return toPathMatch(closest, {
        headingConfirmed: false,
        headingAnchor: carLocation,
      });
    }

    // รถวิ่งได้พอแล้ว หา segment ที่ทิศตรงกันจากทั้งเส้นทาง แล้วถือว่ารู้ทิศแล้ว
    if (hasMovedEnough) {
      const aligned = pickHeadingAlignedSegment(
        route,
        matches,
        matches.keys(),
        movement,
      );
      if (aligned) {
        return toPathMatch(aligned, {
          headingConfirmed: true,
          headingAnchor: carLocation,
        });
      }
    }
  }

  // กันไม่ให้ขากลับช่วงท้ายเส้นทางกระโดดไปขาไปช่วงต้นที่ใช้ถนนเดียวกัน
  const searchWindow = getSearchWindow(
    route,
    previousState.pathIndex,
    closest.index,
  );

  // ตำแหน่งบนเส้นทางเดินหน้าได้ไม่เกินระยะที่รถเคลื่อนที่จริง (บวกค่าเผื่อ)
  // GPS ที่แกว่งตอนรถจอดนิ่งจึงพาตำแหน่งข้ามป้ายไปไม่ได้
  const { metersAlong } = getRouteGeometry(route);
  const previousMeters = metersAlong(previousState.pathProgress);
  // ถอยหลังได้ไม่เกิน 15 เมตรจากจุดที่ไกลที่สุดในรอบนี้ ไม่ใช่จากครั้งก่อน
  // ไม่งั้นตำแหน่งจะค่อย ๆ ไหลถอยทีละนิดได้ไม่จำกัด
  const peakMeters = metersAlong(previousState.peakProgress);
  const travelledMeters = distanceInMeters(
    previousState.progressLocation,
    carLocation,
  );
  const maxAdvanceMeters =
    travelledMeters * MAX_PATH_ADVANCE_FACTOR + PATH_ADVANCE_SLACK_METERS;
  const wrappedIndexes = new Set(searchWindow.wrapped);
  // เงื่อนไขกรอง segment: ช่วงต้นรอบใหม่วัดระยะเดินหน้าข้ามจุดสิ้นสุดของรอบ
  // ส่วนช่วงต่อเนื่องต้องไม่ถอยหลังเกินกำหนดและไม่เดินหน้าเกินระยะที่รถวิ่ง
  const acceptTravel: AcceptMatch = (match) => {
    const meters = metersAlong(match.index + match.t);
    if (wrappedIndexes.has(match.index)) {
      return metersAlong.total - previousMeters + meters <= maxAdvanceMeters;
    }
    return (
      meters >= peakMeters - MAX_PATH_BACKTRACK_METERS &&
      meters - previousMeters <= maxAdvanceMeters
    );
  };

  // ค. กลับรถออกจากต้นทาง: นับเป็นรอบใหม่ทันที ไม่ต้องรอให้วิ่งออกไป 20 เมตร
  // ขาไปกับขากลับช่วงต้นทางใช้ถนนเดียวกัน จึงต้องอยู่บนเส้นต้นรอบด้วย
  const lastSegmentIndex = getLastSegmentIndex(route);
  const distanceToStart = distanceInMeters(carLocation, route.pathPoints[0]);
  const closestToStart = previousState.closestToStartMeters;
  const isLeavingStart =
    previousState.pathProgress >= lastSegmentIndex * 0.75 &&
    closestToStart <= TERMINAL_RADIUS_METERS &&
    distanceToStart >= closestToStart + TERMINAL_DEPARTURE_METERS;
  if (isLeavingStart) {
    const startSegment = findClosestSegment(matches, searchWindow.wrapped);
    const endSegment = findClosestSegment(matches, searchWindow.contiguous);
    // เส้นต้นรอบต้องอยู่ใกล้รถ และไม่ไกลกว่าเส้นท้ายรอบเกิน 5 เมตร
    let endDistance = Number.POSITIVE_INFINITY;
    if (endSegment !== null) {
      endDistance = endSegment.distance;
    }
    if (startSegment !== null) {
      const isStartNearCar = startSegment.distance <= HEADING_AMBIGUITY_METERS;
      const isStartCloseToEnd =
        startSegment.distance <= endDistance + TERMINAL_MATCH_MARGIN_METERS;
      if (isStartNearCar && isStartCloseToEnd) {
        return toPathMatch(startSegment, {
          headingConfirmed: previousState.headingConfirmed,
          headingAnchor: carLocation,
        });
      }
    }
  }

  // ง. ปกติ: เลือก segment ที่ทิศตรงกับที่รถวิ่ง (ข้ามไปช่วงต้นรอบได้เมื่อวิ่งได้ 20 เมตร)
  let aligned: SegmentMatch | null = null;
  if (previousState.headingConfirmed && hasMovedEnough) {
    let searchIndexes = searchWindow.contiguous;
    if (movedMeters >= MIN_WRAP_MOVE_METERS) {
      searchIndexes = [...searchWindow.contiguous, ...searchWindow.wrapped];
    }
    aligned = pickHeadingAlignedSegment(
      route,
      matches,
      searchIndexes,
      movement,
      acceptTravel,
    );
  }

  // ถ้าไม่มี: segment ต่อเนื่องที่ใกล้ที่สุด ถ้าไม่มีอีก: ค้างตำแหน่งเดิมไว้
  let match = aligned;
  if (match === null) {
    match = pickContinuousSegment(matches, searchWindow, acceptTravel);
  }
  if (match === null) {
    const heldIndex = previousState.pathIndex;
    const heldT = previousState.pathProgress - heldIndex;
    const heldPoint = pointOnSegment(route, heldIndex, heldT);
    match = {
      index: heldIndex,
      t: heldT,
      distance: distanceInMeters(carLocation, heldPoint),
    };
  }

  // จ. หลงขา: รถอยู่ห่างตำแหน่งที่เลือกได้เกิน 30 เมตร หาใหม่จากทั้งเส้นทาง
  // (ใช้ทิศถ้ารู้ ไม่งั้นเริ่มนับทิศใหม่จาก segment ที่ใกล้ที่สุด)
  if (match.distance > LOST_DISTANCE_METERS) {
    let relocated: SegmentMatch | null = null;
    if (hasMovedEnough) {
      relocated = pickHeadingAlignedSegment(
        route,
        matches,
        matches.keys(),
        movement,
      );
    }

    if (relocated !== null) {
      return toPathMatch(relocated, {
        headingConfirmed: true,
        headingAnchor: carLocation,
      });
    }
    return toPathMatch(closest, {
      headingConfirmed: false,
      headingAnchor: carLocation,
    });
  }

  // บันทึกสถานะสำหรับครั้งถัดไป
  const progress = match.index + match.t;
  const isNewLap = wrappedIndexes.has(match.index);

  // จุดวัดทิศ: ย้ายเมื่อรถเคลื่อนที่ครบ 20 เมตร ระยะจึงสะสมได้หลาย update
  // สำหรับรถที่วิ่งช้า และ GPS ที่แกว่งตอนจอดนิ่งไม่ถึงระยะนี้
  let headingAnchor = anchor;
  if (
    movedMeters >= MIN_WRAP_MOVE_METERS &&
    movedMeters <= MAX_HEADING_MOVE_METERS
  ) {
    headingAnchor = carLocation;
  }

  // จุดที่ไกลที่สุดในรอบ: เริ่มใหม่เมื่อวนไปรอบใหม่
  let peakProgress = Math.max(previousState.peakProgress, progress);
  if (isNewLap) {
    peakProgress = progress;
  }

  // ตำแหน่ง GPS ตอนตำแหน่งบนเส้นทางเปลี่ยน: อัปเดตเฉพาะเมื่อเปลี่ยนจริง
  const progressChangedMeters = Math.abs(
    metersAlong(progress) - previousMeters,
  );
  let progressLocation = previousState.progressLocation;
  if (isNewLap || progressChangedMeters > 0.5) {
    progressLocation = carLocation;
  }

  // ระยะที่ใกล้ต้นทางที่สุด: จำเฉพาะตอนอยู่ท้ายรอบและใกล้ต้นทาง
  let closestToStartMeters = Number.POSITIVE_INFINITY;
  if (
    progress >= lastSegmentIndex * 0.75 &&
    distanceToStart <= TERMINAL_RADIUS_METERS
  ) {
    closestToStartMeters = Math.min(closestToStart, distanceToStart);
  }

  return toPathMatch(match, {
    headingConfirmed: previousState.headingConfirmed,
    headingAnchor,
    peakProgress,
    progressLocation,
    closestToStartMeters,
  });
};

// -----------------------------------------------------------------------------
// ขั้นที่ 2: เลือกป้ายถัดไป
// -----------------------------------------------------------------------------

// GPS แกว่งไปอยู่หลังป้ายที่ครั้งก่อนรถเลยไปแล้ว หรือถึงแล้ว (อยู่ในรัศมี 5 เมตร)
// เล็กน้อย: ไม่ต้องย้อนกลับไปป้ายนั้น (ไม่นับกรณีวนรอบใหม่ ที่ตำแหน่งลดลงมาก)
const hasLeftStopBefore = (
  route: Route,
  stop: LocalRouteStopOccurrence,
  carProgress: number,
  previousState?: LocalStopProgressState,
) => {
  // ไม่มีสถานะเดิมของสายนี้ ไม่รู้ว่าเคยผ่านป้ายไหนมา
  if (!previousState || previousState.routeId !== route.id) {
    return false;
  }

  // ถอยหลังมาไม่มาก (ไม่ใช่การวนรอบใหม่)
  const isSmallBacktrack =
    previousState.pathProgress - carProgress <= PATH_BACKTRACK_TOLERANCE;
  // ป้ายนี้ไม่ใช่ป้ายถัดไปของครั้งก่อน
  const isNotPreviousNextStop =
    previousState.nextStopPathIndex !== stop.pathIndex;
  // ครั้งก่อนรถเลยป้ายนี้ไปแล้ว หรือป้ายถัดไปของครั้งก่อนอยู่หลังป้ายนี้
  const wasPassed =
    previousState.pathProgress >= stop.pathIndex ||
    previousState.nextStopPathIndex > stop.pathIndex;

  return isSmallBacktrack && isNotPreviousNextStop && wasPassed;
};

// ป้ายแรกที่อยู่ข้างหน้ารถบนเส้นทาง ถ้าไม่มีแล้ว (ช่วงท้ายเส้นทาง) วนกลับไปป้ายแรก
const findUpcomingStopIndex = (
  route: Route,
  stops: LocalRouteStopOccurrence[],
  carProgress: number,
  previousState?: LocalStopProgressState,
) => {
  const index = stops.findIndex(
    (stop) =>
      stop.pathIndex > carProgress &&
      !hasLeftStopBefore(route, stop, carProgress, previousState),
  );
  if (index < 0) {
    return 0;
  }
  return index;
};

// -----------------------------------------------------------------------------
// ฟังก์ชันหลัก
// -----------------------------------------------------------------------------

// คำนวณป้ายถัดไปของรถหนึ่งคัน previousState คือ state จากการเรียกครั้งก่อน
// ของรถคันเดิม (ครั้งแรกไม่ต้องส่ง) คืน null ถ้าสายไม่มีป้าย หรือรถอยู่นอกเส้นทาง
// เกิน 100 เมตร
export const calculateLocalNextStop = (
  route: Route,
  carLocation: LatLng,
  previousState?: LocalStopProgressState,
): LocalNextStopResult | null => {
  if (route.pathPoints.length === 0) {
    return null;
  }
  const { stops } = getRouteGeometry(route);
  if (stops.length === 0) {
    return null;
  }

  // ฉายรถลงทุก segment ครั้งเดียว segment ที่ใกล้ที่สุดใช้ทั้งเช็กว่าอยู่บนสายนี้
  // และเป็นจุดตั้งต้นของขั้นที่ 1
  const matches = matchAllSegments(route, carLocation);
  const closest = findClosestSegment(matches);
  if (closest === null || closest.distance > MAX_ROUTE_DISTANCE_METERS) {
    return null;
  }

  const pathMatch = findNearestPathIndex(
    route,
    carLocation,
    matches,
    closest,
    previousState,
  );

  const upcomingIndex = findUpcomingStopIndex(
    route,
    stops,
    pathMatch.pathProgress,
    previousState,
  );

  // อยู่ในรัศมี 5 เมตรของป้าย ถือว่าถึงแล้ว เลื่อนไปป้ายถัดไป
  const hasArrived =
    distanceInMeters(carLocation, stops[upcomingIndex]) <=
    STOP_ARRIVAL_RADIUS_METERS;
  let nextStop = stops[upcomingIndex];
  if (hasArrived) {
    // ใช้ % เพื่อวนจากป้ายสุดท้ายกลับไปป้ายแรก
    nextStop = stops[(upcomingIndex + 1) % stops.length];
  }

  return {
    nextStopSequence: nextStop.sequence,
    nextStopPathIndex: nextStop.pathIndex,
    state: {
      routeId: route.id,
      ...pathMatch,
      nextStopPathIndex: nextStop.pathIndex,
    },
  };
};
