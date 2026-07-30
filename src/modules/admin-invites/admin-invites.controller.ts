import type { Request, Response, NextFunction } from "express";
import * as adminInvitesService from "./admin-invites.service.ts";
import { insertAdminInviteSchema } from "../../db/types.ts";
import { z } from "zod";

const emailSchema = z.object({ email: z.string().email() });

export async function getAll(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await adminInvitesService.getAll();
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function invite(req: Request, res: Response, next: NextFunction) {
    try {
        const { email } = emailSchema.parse(req.body);
        const result = await adminInvitesService.invite(email, req.user!.id);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
}

export async function revoke(req: Request, res: Response, next: NextFunction) {
    try {
        const { email } = emailSchema.parse(req.params);
        await adminInvitesService.revoke(email);
        res.json({ success: true, message: "Invite revoked" });
    } catch (error) {
        next(error);
    }
}
