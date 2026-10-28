// เครื่องมือคำนวณระยะทางจากพิกัด lat/lng ใช้ร่วมกันทั้งการกรองรถและการหาป้ายถัดไป

export type LatLng = { lat: number; lng: number };

// ระยะทาง 1 องศาละติจูดโดยประมาณ หน่วยเป็นเมตร
const METERS_PER_DEGREE_LAT = 111320;

// รัศมีโลกโดยประมาณ หน่วยเป็นเมตร
const EARTH_RADIUS_METERS = 6371000;

//แปลงองศาเป็นเรเดียน เพราะ Math.sin และ Math.cos ของ JavaScript รับค่าเป็นเรเดียน (180° = π เรเดียน)
const toRadians = (value: number) => (value * Math.PI) / 180;

// ระยะทางระหว่างพิกัดสองจุดด้วยสูตร Haversine หน่วยเป็นเมตร
export const distanceInMeters = (first: LatLng, second: LatLng) => {
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lng - first.lng);
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);

  // ค่ากลางของสูตร Haversine
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  // มุมที่ศูนย์กลางโลกระหว่างสองจุด (เรเดียน)
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // ความยาวส่วนโค้ง = มุม × รัศมี
  return EARTH_RADIUS_METERS * centralAngle;
};

// แปลงพิกัดเป็นเมตรบนระนาบ (x = ตะวันออก, y = เหนือ) โดยให้ origin เป็น (0, 0)
// แม่นพอสำหรับระยะไม่กี่กิโลเมตรภายในวิทยาเขต
export const toLocalMeters = (origin: LatLng, point: LatLng) => {
  // ลองจิจูดต้องคูณ cos(ละติจูด) เพราะเส้นลองจิจูดชิดกันขึ้นเมื่อห่างเส้นศูนย์สูตร
  const x =
    (point.lng - origin.lng) *
    METERS_PER_DEGREE_LAT *
    Math.cos(toRadians(origin.lat));
  const y = (point.lat - origin.lat) * METERS_PER_DEGREE_LAT;

  return { x, y };
};
