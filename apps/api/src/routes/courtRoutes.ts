import { Router } from 'express';
import { createCourt, deleteCourt, getCourts, updateCourt } from '../controllers/courtController';
import { requireRole } from '../middlewares/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(getCourts));
router.post('/', requireRole('owner'), asyncHandler(createCourt));
router.patch('/:id', requireRole('owner'), asyncHandler(updateCourt));
router.delete('/:id', requireRole('owner'), asyncHandler(deleteCourt));

export default router;
