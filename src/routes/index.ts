import { Router } from 'express';
import courtRoutes from './courtRoutes';
import healthRoutes from './healthRoutes';
import reservationRoutes from './reservationRoutes';
import analyticsRoutes from './analyticsRoutes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/courts', courtRoutes);
router.use('/reservations', reservationRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
