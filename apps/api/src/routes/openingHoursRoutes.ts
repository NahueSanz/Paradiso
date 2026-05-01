import { Router } from 'express';
import {
  getOpeningHours,
  getWeeklyDefaults,
  updateDefaultHours,
  updateDateHours,
  deleteDateHours,
} from '../controllers/openingHoursController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/',        asyncHandler(getOpeningHours));
router.get('/default', asyncHandler(getWeeklyDefaults));
router.put('/default', asyncHandler(updateDefaultHours));
router.put('/date',    asyncHandler(updateDateHours));
router.delete('/date', asyncHandler(deleteDateHours));

export default router;
