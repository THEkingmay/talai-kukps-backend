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
    this.client.on("ready", () => console.log("[Redis]: Ready and Connected"));
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

  async deleteAll(): Promise<void> {
    const client = this.ensureConnected();
    await client.flushAll();
  }

  async hGetAll<T extends Record<string, any>>(key: string): Promise<T | null> {
    const client = this.ensureConnected();
    const data = await client.hGetAll(key);

    if (!data) return null;

    try {
      return data as T;
    } catch (err) {
      console.error(`[Redis Parse Error] Key: ${key}`, err);
      return null;
    }
  }

  async hSet<T extends { [K in keyof T]: string | number }>(
    key: string,
    value: T,
    ttlInSeconds?: number,
  ): Promise<void> {
    const client = this.ensureConnected();
    await client.hSet(key, value);
    if (ttlInSeconds) {
      await client.expire(key, ttlInSeconds);
    }
  }
  async hSetField<T extends string | number>(
    key: string,
    field: string,
    value: T,
    ttlInSeconds?: number,
  ): Promise<void> {
    const client = this.ensureConnected();
    await client.hSet(key, field, value);
    if (ttlInSeconds) {
      await client.expire(key, ttlInSeconds);
    }
  }

  async hDel(key: string, field: string): Promise<void> {
    const client = this.ensureConnected();
    await client.hDel(key, field);
  }

  async keys(pattern: string): Promise<string[]> {
    const client = this.ensureConnected();
    return await client.keys(pattern);
  }

  async getAllDataInRedis(): Promise<Record<string, any>> {
    const client = this.ensureConnected();
    const keys = await this.keys("*");
    const result: Record<string, any> = {};

    for (const key of keys) {
      const type = await client.type(key);
      const ttl = await client.ttl(key);

      let value: any = null;
      if (type === "hash") {
        value = await client.hGetAll(key);
      } else if (type === "string") {
        const raw = await client.get(key);
        try {
          value = raw ? JSON.parse(raw) : raw;
        } catch {
          value = raw;
        }
      } else {
        value = `<unhandled type: ${type}>`;
      }

      result[key] = {
        type,
        ttl: ttl === -1 ? "no expiration" : `${ttl}s`,
        value,
      };
    }

    return result;
  }
}

export default new RedisService();
