import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

/**
 * เข้ารหัสข้อความด้วย AES-256-CBC
 */
export function encryptPassword(password: string, secretKey: string): string {
    const key = crypto.createHash("sha256").update(secretKey).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(password, "utf8", "hex");
    encrypted += cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * ถอดรหัสข้อความที่ถูกเข้ารหัสด้วย AES-256-CBC
 */
export function decryptPassword(encryptedData: string, secretKey: string): string {
    const key = crypto.createHash("sha256").update(secretKey).digest();
    const [ivHex, encryptedText] = encryptedData.split(":");
    if (!ivHex || !encryptedText) {
        throw new Error("Invalid encrypted password format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

/**
 * สร้าง username และ password สำหรับ MQTT ของรถ พร้อมเข้ารหัส password
 */
export function generateMqttCredential(): {
    carMqttUsername: string;
    encryptedMqttPassword: string;
} {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
        throw new Error("ENCRYPTION_KEY is not defined in environment variables");
    }

    const carMqttUsername = `car_${crypto.randomBytes(6).toString("hex")}`;
    const rawPassword = crypto.randomBytes(16).toString("hex");
    const encryptedMqttPassword = encryptPassword(rawPassword, ENCRYPTION_KEY);

    return { carMqttUsername, encryptedMqttPassword };
}

