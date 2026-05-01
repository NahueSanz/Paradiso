import { Router } from 'express';
import { getMembership, updateMembership } from '../controllers/membershipController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(getMembership));
router.patch('/:id', asyncHandler(updateMembership));

export default router;
