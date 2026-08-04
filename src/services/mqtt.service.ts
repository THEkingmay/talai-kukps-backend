import mqtt from "mqtt";

class MqttService {
    private client: mqtt.MqttClient | null = null;
    connect(brokerUrl: string, options: mqtt.IClientOptions | {}) {
        if (!brokerUrl) {
            console.error("[ MQTT Error ]: BROKER_URL is missing in .env!");
            return;
        }

        this.client = mqtt.connect(brokerUrl, {
            clientId: `talai-server-${Math.random().toString(16).slice(2, 10)}`, // unique ID ป้องกัน session ชน
            keepalive: 60, // ส่ง Ping ทุก 60 วินาที
            reconnectPeriod: 5000, // ถ้าหลุด ให้พยายาม Reconnect ทุก 5 วินาที
            connectTimeout: 30 * 1000, // Connection Timeout 30 วินาที
            resubscribe: true,
            clean: true, // ไม่เก็บ session เก่า
            rejectUnauthorized: true,
            ...options,
        });
        this.client.on("connect", () => {
            console.log("Connected to MQTT Broker");
            this.client?.subscribe("cars/#", (err) => {
                if (!err) console.log(`[MQTT] Subscribed to topic: /cars/#`);
            });
        });

        this.client.on("error", (err) => {
            console.error("[ MQTT Error ]:", err);
        });
        this.client.on("offline", () => {
            console.warn("[MQTT] Client went offline");
        });
    }
    onMessage(callback: (topic: string, payload: string) => void) {
        if (!this.client) return;
        this.client.on("message", (topic, payload) => {
            callback(topic, payload.toString());
        });
    }
}

export default new MqttService();
