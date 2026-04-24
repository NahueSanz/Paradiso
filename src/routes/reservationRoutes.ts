import { Router } from 'express';
import {
  createReservation,
  deleteReservation,
  getReservations,
  payReservation,
  updateReservation,
  updateReservationNote,
} from '../controllers/reservationController';
import { resolveMembership } from '../middlewares/resolveMembership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(resolveMembership);

router.get('/',          asyncHandler(getReservations));
router.post('/',         asyncHandler(createReservation));
router.put('/:id',       asyncHandler(updateReservation));
router.post('/:id/pay',  asyncHandler(payReservation));
router.patch('/:id/note', asyncHandler(updateReservationNote));
router.delete('/:id',    asyncHandler(deleteReservation));

export default router;
