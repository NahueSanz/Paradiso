import { Router } from 'express';
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '../controllers/reservationController';
import { resolveMembership } from '../middlewares/resolveMembership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(resolveMembership);

router.get('/', asyncHandler(getReservations));
router.post('/', asyncHandler(createReservation));
router.put('/:id', asyncHandler(updateReservation));
router.delete('/:id', asyncHandler(deleteReservation));

export default router;
