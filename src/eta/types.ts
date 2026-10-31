// ชนิดข้อมูลที่ตัวคำนวณป้ายถัดไป (src/eta) ใช้
// ย้ายมาจาก TalaiApp (src/services/talaiApi.ts) โค้ดใน src/eta จึงไม่ต้องพึ่ง database
// แถวจากตาราง route_points (RoutePoint ใน db/types.ts) ส่งเข้ามาได้เลย เพราะมี field ครบ

// จุดหนึ่งจุดบนเส้นทาง จุดที่มีชื่อ (name) คือป้ายรถ
export type RoutePoint = {
  lat: number;
  lng: number;
  sequence?: number | null;
  name?: string | null;
  timeToNextSecs?: number | null;
};

// สายรถหนึ่งสาย พร้อมจุดบนเส้นทาง เรียงตาม sequence
export type Route = {
  id: string;
  name: string;
  pathPoints: RoutePoint[];
};
