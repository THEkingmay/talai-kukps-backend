// {lat:number, lng:number , status : 'active'} format ที่ publish
import * as mqtt from "mqtt";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// โหลด .env.test จาก root ของ project
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env.test") });

// ---------------------- Types ----------------------

interface RoutePoint {
  lat: number;
  lng: number;
  sequence: number;
}

interface CarPayload {
  lat: number;
  lng: number;
  status: "active";
}

// ---------------------- Route Data ----------------------

const car1Route: RoutePoint[] = [
  { lat: 14.0263119327051, lng: 99.9841630554675, sequence: 10000 },
  { lat: 14.0265099394586, lng: 99.983959614385, sequence: 20000 },
  { lat: 14.0265463893745, lng: 99.9828976910718, sequence: 30000 },
  { lat: 14.0264578042906, lng: 99.982886776369, sequence: 40000 },
  { lat: 14.0264682185553, lng: 99.9824791694407, sequence: 50000 },
  { lat: 14.0265879825649, lng: 99.9823236352181, sequence: 60000 },
  { lat: 14.0266608823662, lng: 99.9820930155086, sequence: 70000 },
  { lat: 14.0266504681102, lng: 99.9809399169615, sequence: 80000 },
  { lat: 14.0267077465119, lng: 99.9807629297426, sequence: 90000 },
  { lat: 14.0269056172439, lng: 99.9807200237502, sequence: 100000 },
  { lat: 14.027400293327, lng: 99.9807307502483, sequence: 110000 },
  { lat: 14.0274731928701, lng: 99.9805001305388, sequence: 120000 },
  { lat: 14.0274888141978, lng: 99.9800549808672, sequence: 130000 },
  { lat: 14.0276189918868, lng: 99.9795615619539, sequence: 140000 },
  { lat: 14.0277752050161, lng: 99.9792612200067, sequence: 150000 },
  { lat: 14.0281917728406, lng: 99.9795401089577, sequence: 160000 },
  { lat: 14.0281188735259, lng: 99.9796205576936, sequence: 170000 },
  { lat: 14.0278689328426, lng: 99.9794382072256, sequence: 180000 },
  { lat: 14.0275304710663, lng: 99.9791217755313, sequence: 190000 },
  { lat: 14.0272024230218, lng: 99.9787570745954, sequence: 200000 },
  { lat: 14.0267286787732, lng: 99.9782734201154, sequence: 210000 },
  { lat: 14.0272441836973, lng: 99.9777370952097, sequence: 220000 },
  { lat: 14.0274316397461, lng: 99.9773884840211, sequence: 230000 },
  { lat: 14.0277283224658, lng: 99.9764549677383, sequence: 240000 },
  { lat: 14.0277751863934, lng: 99.9751141554742, sequence: 250000 },
  { lat: 14.0267488528216, lng: 99.9750933196958, sequence: 255000 },
  { lat: 14.0262651216864, lng: 99.975098065727, sequence: 260000 },
  { lat: 14.0258121003354, lng: 99.9751248819723, sequence: 270000 },
  { lat: 14.0258383888075, lng: 99.9746311287328, sequence: 275000 },
  { lat: 14.0258485503623, lng: 99.9738216124515, sequence: 280000 },
  { lat: 14.0255100856044, lng: 99.9737947962063, sequence: 290000 },
  { lat: 14.0247706685497, lng: 99.9738323389497, sequence: 300000 },
  { lat: 14.0236511241065, lng: 99.9738055227044, sequence: 310000 },
  { lat: 14.0220108514508, lng: 99.9737787064591, sequence: 320000 },
  { lat: 14.0211204128123, lng: 99.9738001594553, sequence: 330000 },
  { lat: 14.0210370967396, lng: 99.9738859714403, sequence: 340000 },
  { lat: 14.0210631330156, lng: 99.9747816340327, sequence: 350000 },
  { lat: 14.0210327035835, lng: 99.9756390150907, sequence: 355000 },
  { lat: 14.021042303995, lng: 99.9759669120742, sequence: 360000 },
  { lat: 14.0210006459482, lng: 99.9776134295346, sequence: 370000 },
  { lat: 14.0213866317427, lng: 99.9776023698791, sequence: 375000 },
  { lat: 14.0216307230981, lng: 99.9776187927836, sequence: 380000 },
  { lat: 14.0216671737893, lng: 99.9759561855761, sequence: 390000 },
  { lat: 14.0221222917741, lng: 99.9759561540138, sequence: 395000 },
  { lat: 14.0225940608498, lng: 99.9759776385723, sequence: 400000 },
  { lat: 14.0236198809273, lng: 99.9760312710629, sequence: 410000 },
  { lat: 14.023588637744, lng: 99.9756075743874, sequence: 420000 },
  { lat: 14.0237188176466, lng: 99.9756075743874, sequence: 430000 },
  { lat: 14.0237031960622, lng: 99.9760902668025, sequence: 440000 },
  { lat: 14.0237136104519, lng: 99.9770717413799, sequence: 450000 },
  { lat: 14.0236893569616, lng: 99.9783857502574, sequence: 460000 },
  { lat: 14.023673296405, lng: 99.9791797156881, sequence: 470000 },
  { lat: 14.0244543744243, lng: 99.9791850789372, sequence: 480000 },
  { lat: 14.0249126056244, lng: 99.9791743524391, sequence: 490000 },
  { lat: 14.0255166362623, lng: 99.9790670874579, sequence: 500000 },
  { lat: 14.025761372361, lng: 99.9790027284692, sequence: 510000 },
  { lat: 14.0261258724495, lng: 99.9788471942466, sequence: 520000 },
  { lat: 14.0261414938689, lng: 99.9787399292655, sequence: 530000 },
  { lat: 14.0264435077685, lng: 99.9785522155485, sequence: 540000 },
  { lat: 14.0267286787732, lng: 99.9782734201154, sequence: 550000 },
  { lat: 14.0267975925237, lng: 99.9781767881145, sequence: 560000 },
  { lat: 14.0274172395298, lng: 99.97888473699, sequence: 570000 },
  { lat: 14.0277752050161, lng: 99.9792612200067, sequence: 580000 },
  { lat: 14.0281917728406, lng: 99.9795401089577, sequence: 590000 },
  { lat: 14.0281188735259, lng: 99.9796205576936, sequence: 600000 },
  { lat: 14.0278689328426, lng: 99.9794382072256, sequence: 610000 },
  { lat: 14.0276984233333, lng: 99.979356702907, sequence: 620000 },
  { lat: 14.0276189918868, lng: 99.9795615619539, sequence: 630000 },
  { lat: 14.0274888141978, lng: 99.9800549808672, sequence: 640000 },
  { lat: 14.0274731928701, lng: 99.9805001305388, sequence: 650000 },
  { lat: 14.027400293327, lng: 99.9807307502483, sequence: 660000 },
  { lat: 14.0269056172439, lng: 99.9807200237502, sequence: 670000 },
  { lat: 14.0267077465119, lng: 99.9807629297426, sequence: 680000 },
  { lat: 14.0266504681102, lng: 99.9809399169615, sequence: 690000 },
  { lat: 14.0266608823662, lng: 99.9820930155086, sequence: 700000 },
  { lat: 14.0265879825649, lng: 99.9823236352181, sequence: 710000 },
  { lat: 14.0264682185553, lng: 99.9824791694407, sequence: 720000 },
  { lat: 14.0264578042906, lng: 99.982886776369, sequence: 730000 },
  { lat: 14.0265463893745, lng: 99.9828976910718, sequence: 740000 },
  { lat: 14.0265099394586, lng: 99.983959614385, sequence: 750000 },
  { lat: 14.0263119327051, lng: 99.9841630554675, sequence: 760000 },
];

const car2Route: RoutePoint[] = [
  { lat: 14.0216999564571, lng: 99.9888952763898, sequence: 10000 },
  { lat: 14.0219126218308, lng: 99.9888120086708, sequence: 20000 },
  { lat: 14.0219920624848, lng: 99.9856424788285, sequence: 30000 },
  { lat: 14.0232518454148, lng: 99.9824885947317, sequence: 40000 },
  { lat: 14.0235019677322, lng: 99.9811137786281, sequence: 50000 },
  { lat: 14.0235227036436, lng: 99.9791713744228, sequence: 60000 },
  { lat: 14.0230226643921, lng: 99.9790000238654, sequence: 70000 },
  { lat: 14.0209819535785, lng: 99.9790239266514, sequence: 80000 },
  { lat: 14.0210019824108, lng: 99.9783560782003, sequence: 90000 },
  { lat: 14.0209924285668, lng: 99.9776283656885, sequence: 100000 },
  { lat: 14.0230751622295, lng: 99.9776386013576, sequence: 110000 },
  { lat: 14.0235682176908, lng: 99.9773950185925, sequence: 120000 },
  { lat: 14.0235645291104, lng: 99.9769069062112, sequence: 130000 },
  { lat: 14.0235942691628, lng: 99.9760314493575, sequence: 140000 },
  { lat: 14.0221581070805, lng: 99.9759831570908, sequence: 150000 },
  { lat: 14.0210378732077, lng: 99.9759445784596, sequence: 160000 },
  { lat: 14.0210175030618, lng: 99.9757919672668, sequence: 170000 },
  { lat: 14.0210225596163, lng: 99.9752015766804, sequence: 180000 },
  { lat: 14.0210330675008, lng: 99.9740691374336, sequence: 190000 },
  { lat: 14.021023606794, lng: 99.9721749839092, sequence: 200000 },
  { lat: 14.0247714661027, lng: 99.9721898816157, sequence: 210000 },
  { lat: 14.0247341298474, lng: 99.9746972157069, sequence: 220000 },
  { lat: 14.0246926376807, lng: 99.9760432784948, sequence: 230000 },
  { lat: 14.0237140187175, lng: 99.9760218228948, sequence: 240000 },
  { lat: 14.0236934390869, lng: 99.9782804894689, sequence: 250000 },
  { lat: 14.0235738087755, lng: 99.9817088043143, sequence: 260000 },
  { lat: 14.0231391301004, lng: 99.9831100881022, sequence: 270000 },
  { lat: 14.0221184114921, lng: 99.9856642100218, sequence: 280000 },
  { lat: 14.0220279120045, lng: 99.9887367679856, sequence: 290000 },
  { lat: 14.0219919200024, lng: 99.9894396725179, sequence: 310000 },
  { lat: 14.0218563707696, lng: 99.9901157404552, sequence: 320000 },
  { lat: 14.0217366079086, lng: 99.9900675560109, sequence: 330000 },
  { lat: 14.0218612299183, lng: 99.9895363252884, sequence: 340000 },
  { lat: 14.0218875036448, lng: 99.9889945439329, sequence: 350000 },
  { lat: 14.0216999564571, lng: 99.9888952763898, sequence: 360000 },
];

// ---------------------- MQTT Simulator ----------------------

const PUBLISH_INTERVAL_MS = 3000; // publish ทุก 3 วินาที

/**
 * สร้าง MQTT client สำหรับรถแต่ละคัน แล้ววิ่ง loop ส่ง location ทุก 3 วินาที
 * โดยวิ่ง loop ต่อเนื่องไม่หยุด (กลับไปเริ่มต้นเมื่อถึงจุดสุดท้าย)
 */
function startCarSimulator(config: {
  carName: string;
  mqttUrl: string;
  username: string;
  password: string;
  topic: string;
  route: RoutePoint[];
}): void {
  const { carName, mqttUrl, username, password, topic, route } = config;

  const client = mqtt.connect(mqttUrl, {
    username,
    password,
    // HiveMQ Cloud ใช้ TLS port 8883 (mqtts://)
    rejectUnauthorized: true,
  });

  let currentIndex = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  client.on("connect", () => {
    console.log(`[${carName}] Connected to MQTT broker`);

    intervalId = setInterval(() => {
      const point = route[currentIndex];
      const payload: CarPayload = {
        lat: point.lat,
        lng: point.lng,
        status: "active",
      };

      client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
        if (err) {
          console.error(
            `[${carName}] Publish error at seq ${point.sequence}:`,
            err.message,
          );
        } else {
          console.log(
            `[${carName}] seq=${point.sequence} lat=${point.lat.toFixed(7)} lng=${point.lng.toFixed(7)}`,
          );
        }
      });

      // เลื่อนไปจุดถัดไป วนกลับเมื่อถึงสุดท้าย
      currentIndex = (currentIndex + 1) % route.length;
    }, PUBLISH_INTERVAL_MS);
  });

  client.on("error", (err) => {
    console.error(`[${carName}] MQTT error:`, err.message);
  });

  client.on("close", () => {
    console.warn(`[${carName}] Connection closed`);
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  client.on("reconnect", () => {
    console.log(`[${carName}] Reconnecting...`);
  });
}

// ---------------------- Main ----------------------

const mqttUrl = process.env.MQTT_URL;
const car1Username = process.env.CAR1_MQTT_USERNAME;
const car1Password = process.env.CAR1_MQTT_PASSWORD;
const car1Topic = process.env.CAR1_MQTT_TOPIC;
const car2Username = process.env.CAR2_MQTT_USERNAME;
const car2Password = process.env.CAR2_MQTT_PASSWORD;
const car2Topic = process.env.CAR2_MQTT_TOPIC;

if (
  !mqttUrl ||
  !car1Username ||
  !car1Password ||
  !car1Topic ||
  !car2Username ||
  !car2Password ||
  !car2Topic
) {
  console.error(
    "Missing required environment variables. Please check .env.test",
  );
  process.exit(1);
}

// เริ่ม simulator ทั้งสองคันพร้อมกัน (parallel)
startCarSimulator({
  carName: "CAR1 (หอใน)",
  mqttUrl,
  username: car1Username,
  password: car1Password,
  topic: car1Topic,
  route: car1Route,
});

startCarSimulator({
  carName: "CAR2 (หน้ามอ)",
  mqttUrl,
  username: car2Username,
  password: car2Password,
  topic: car2Topic,
  route: car2Route,
});

console.log("Car simulators started. Press Ctrl+C to stop.");
