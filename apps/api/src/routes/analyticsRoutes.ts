import { Router } from 'express';
import { revenueHandler, reservationsReportHandler } from '../controllers/analyticsController';
import { requireRole } from '../middlewares/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/revenue', requireRole('owner'), asyncHandler(revenueHandler));
router.get('/reservations', requireRole('owner'), asyncHandler(reservationsReportHandler));

export default router;
