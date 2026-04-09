import { Router } from 'express';
import {
  createReservation,
  deleteReservation,
  getReservations,
  updateReservation,
} from '../controllers/reservationController';
import { resolveMembership } from '../middlewares/resolveMembership';

const router = Router();

router.use(resolveMembership);

router.get('/', getReservations);
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.delete('/:id', deleteReservation);

export default router;
