import { Router } from 'express';
import { getSchedule } from '../controllers/scheduleController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(getSchedule));

export default router;
