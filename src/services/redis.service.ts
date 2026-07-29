import { createClient, type RedisClientType } from "redis";

class RedisService {
    private client: RedisClientType | undefined;

    async connect(url: string): Promise<void> {
        if (this.client?.isOpen) return;

        this.client = createClient({
            url: url,
            socket: {
                connectTimeout: 10000,
            },
            pingInterval: 30000,
        });

        this.client.on("error", (err) => {
            console.error("[Redis Error]:", err.message);
        });
        this.client.on("connect", () => console.log("[Redis]: Connecting..."));
        this.client.on("ready", () =>
            console.log("[Redis]: Ready and Connected"),
        );
        this.client.on("reconnecting", () =>
            console.log("[Redis]: Reconnecting..."),
        );

        await this.client.connect();
    }

    private ensureConnected(): RedisClientType {
        if (!this.client || !this.client.isOpen) {
            throw new Error(
                "[Redis]: Client is not connected. Call connect() first.",
            );
        }
        return this.client;
    }

    async get(key: string): Promise<string | number | boolean | object | null> {
        const client = this.ensureConnected();
        const value = await client.get(key);
        if (!value) return null;
        return JSON.parse(value);
    }

    async set(
        key: string,
        value: string | number | boolean | object,
        ttlInSeconds?: number,
    ): Promise<void> {
        const client = this.ensureConnected();
        if (ttlInSeconds) {
            await client.set(key, JSON.stringify(value), { EX: ttlInSeconds });
        } else {
            await client.set(key, JSON.stringify(value));
        }
    }

    async delete(key: string): Promise<void> {
        const client = this.ensureConnected();
        await client.del(key);
    }

    async hGetAll<T extends Record<string, any>>(
        key: string,
    ): Promise<T | null> {
        const client = this.ensureConnected();
        const data = await client.hGet(key, "data");

        if (!data) return null;

        try {
            return JSON.parse(data) as T;
        } catch (err) {
            console.error(`[Redis Parse Error] Key: ${key}`, err);
            return null;
        }
    }

    async hSet<T extends object>(key: string, value: T): Promise<void> {
        const client = this.ensureConnected();
        await client.hSet(key, "data", JSON.stringify(value));
    }

    async hDel(key: string, field: string): Promise<void> {
        const client = this.ensureConnected();
        await client.hDel(key, field);
    }
}

export default new RedisService();
