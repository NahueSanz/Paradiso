import { Router } from 'express';
import {
  createFixedReservation,
  deleteFixedReservation,
  getFixedReservations,
  payFixedReservation,
  toggleFixedReservation,
  updateFixedReservation,
} from '../controllers/fixedReservationController';
import { resolveMembership } from '../middlewares/resolveMembership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(resolveMembership);

router.get('/',              asyncHandler(getFixedReservations));
router.post('/',             asyncHandler(createFixedReservation));
router.put('/:id',           asyncHandler(updateFixedReservation));
router.delete('/:id',        asyncHandler(deleteFixedReservation));
router.patch('/:id/pay',     asyncHandler(payFixedReservation));
router.patch('/:id/toggle',  asyncHandler(toggleFixedReservation));

export default router;
