import { Router } from 'express';
import { revenueHandler, reservationsReportHandler } from '../controllers/analyticsController';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/revenue', requireRole('owner'), revenueHandler);
router.get('/reservations', requireRole('owner'), reservationsReportHandler);

export default router;
