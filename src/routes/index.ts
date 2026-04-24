import { Router } from "express";
import authRoutes from "./authRoutes";
import clubRoutes from "./clubRoutes";
import courtRoutes from "./courtRoutes";
import healthRoutes from "./healthRoutes";
import reservationRoutes from "./reservationRoutes";
import analyticsRoutes from "./analyticsRoutes";
import invitationRoutes from "./invitationRoutes";
import membershipRoutes from "./membershipRoutes";
import fixedReservationRoutes from "./fixedReservationRoutes";
import scheduleRoutes from "./scheduleRoutes";
import cashRoutes from "./cashRoutes";
import productRoutes from "./productRoutes";
import movementRoutes from "./movementRoutes";
import openingHoursRoutes from "./openingHoursRoutes";
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
router.use("/fixed-reservations", fixedReservationRoutes);
router.use("/schedule", scheduleRoutes);
router.use("/cash", cashRoutes);
router.use("/products", productRoutes);
router.use("/movements", movementRoutes);
router.use("/opening-hours", openingHoursRoutes);

export default router;
