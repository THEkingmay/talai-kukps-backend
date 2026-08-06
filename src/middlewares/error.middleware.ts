import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = "คำขอไม่ถูกต้อง") {
        super(message, 400);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = "ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบ") {
        super(message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = "ไม่มีสิทธิ์ใช้งานส่วนนี้") {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = "ไม่พบข้อมูลที่ต้องการ") {
        super(message, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message: string = "ข้อมูลซ้ำในระบบ") {
        super(message, 409);
    }
}

export class InternalServerError extends AppError {
    constructor(message: string = "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์") {
        super(message, 500);
    }
}

export function errorMiddleware(
    err: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction,
) {
    let statusCode = 500;
    let message = "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
    } else if (err instanceof ZodError) {
        statusCode = 400;
        message = err.issues.map((e) => e.message).join(", ") || "Validation Error";
    } else if (err instanceof Error) {
        message = err.message;
        if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
            statusCode = (err as any).statusCode;
        }
    }

    console.error(`[Error ${statusCode}] ${req.method} ${req.path}:`, err.message);

    res.status(statusCode).json({
        success: false,
        message,
    });
}

