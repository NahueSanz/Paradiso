import { Router } from 'express';
import { revenueHandler, reservationsReportHandler } from '../controllers/analyticsController';

const router = Router();

router.get('/revenue', revenueHandler);
router.get('/reservations', reservationsReportHandler);

export default router;
