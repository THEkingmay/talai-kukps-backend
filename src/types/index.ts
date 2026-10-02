// Shared TypeScript types (moved from db/custom-types.ts)

export interface SessionUserType {
  id: string;
  email: string;
  role: "admin" | "user" | "superadmin" | "driver";
}

export interface MqttMessageType {
  status: "active" | "inactive";
  lat: number;
  lng: number;
  createdAt: string; // timestampz
}

export interface WebSocketLocationBroadcastType extends MqttMessageType {
  type: "location";
  carId: string;
}

export interface WebSocketAlertBroadcastType {
  type: "alert";
  alertType: "driver_not_confirmed";
  carId: string;
  driverId: string | null;
  message: string;
  timestamp: string;
}

export type WebSocketBroadcastType =
  | WebSocketLocationBroadcastType
  | WebSocketAlertBroadcastType;

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: SessionUserType;
    }
  }
}
