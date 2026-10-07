import { Router } from "express";
import { sessionMiddleware } from "../../middlewares/session.middleware.ts";
import * as usersController from "./users.controller.ts";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();
router.use(sessionMiddleware);

router.get("/", usersController.getAll);
router.get("/:id", usersController.getById);
router.get("/me", usersController.getMe);

// ลบ users
router.delete("/:id", usersController.deleteUser);

// อับเดตสถานะ users
router.patch("/restore/:id", usersController.restoreDeletedUser);

// อับเดตโปรไฟล์
router.patch(
  "/profile/:id",
  upload.single("profileImage"),
  usersController.updateProfile,
);

export default router;
