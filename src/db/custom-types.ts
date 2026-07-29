export interface SessionUserType {
    id: string;
    role: "admin" | "user";
    loginAt: string; // timestampz
}

export interface WebSocketLocationBroadcastType {
    status: "active";
    lat: number;
    lng: number;
    createdAt: string; // timestampz
}
