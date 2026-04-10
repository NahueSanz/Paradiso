import { Router } from "express";
import authRoutes from "./authRoutes";
import clubRoutes from "./clubRoutes";
import courtRoutes from "./courtRoutes";
import healthRoutes from "./healthRoutes";
import reservationRoutes from "./reservationRoutes";
import analyticsRoutes from "./analyticsRoutes";
import invitationRoutes from "./invitationRoutes";
import membershipRoutes from "./membershipRoutes";
import { authenticate } from "../middlewares/authenticate";
import { acceptInvitation } from "../controllers/invitationController";

const router = Router();

// ─── PUBLIC — no token required ──────────────────────────────────────────────
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.post("/invitations/accept", acceptInvitation);

// ─── PROTECTED — valid JWT required ──────────────────────────────────────────
router.use(authenticate);
router.use("/clubs", clubRoutes);
router.use("/courts", courtRoutes);
router.use("/reservations", reservationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/invitations", invitationRoutes);
router.use("/membership", membershipRoutes);

export default router;
