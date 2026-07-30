// Shared TypeScript types (moved from db/custom-types.ts)

export interface SessionUserType {
    id: string;
    role: "admin" | "user";
    loginAt: string; // timestampz
}

export interface MqttMessageType {
    status: "active";
    lat: number;
    lng: number;
    createdAt: string; // timestampz
}

export interface WebSocketLocationBroadcastType extends MqttMessageType {
    carId: string;
}

// Extend Express Request to carry authenticated user
declare global {
    namespace Express {
        interface Request {
            user?: SessionUserType;
        }
    }
}
