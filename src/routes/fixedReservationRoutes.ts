import { Router } from 'express';
import {
  cancelInstance,
  createFixedReservation,
  deleteFixedReservation,
  getFixedReservations,
  payInstance,
  toggleFixedReservation,
  updateFixedReservation,
} from '../controllers/fixedReservationController';
import { resolveMembership } from '../middlewares/resolveMembership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(resolveMembership);

// Instance-level routes — defined before /:id to avoid segment collision
router.post('/instances/:instanceId/pay',    asyncHandler(payInstance));
router.patch('/instances/:instanceId/cancel', asyncHandler(cancelInstance));

// Rule-level routes
router.get('/',             asyncHandler(getFixedReservations));
router.post('/',            asyncHandler(createFixedReservation));
router.put('/:id',          asyncHandler(updateFixedReservation));
router.delete('/:id',       asyncHandler(deleteFixedReservation));
router.patch('/:id/toggle', asyncHandler(toggleFixedReservation));

export default router;
