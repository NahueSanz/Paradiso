import { Router } from 'express';
import courtRoutes from './courtRoutes';
import healthRoutes from './healthRoutes';
import reservationRoutes from './reservationRoutes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/courts', courtRoutes);
router.use('/reservations', reservationRoutes);

export default router;
