import { Router } from 'express';
import { createClub, getClubs, updateClub } from '../controllers/clubController';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/', getClubs);
router.post('/', requireRole('owner'), createClub);
router.patch('/:id', requireRole('owner'), updateClub);

export default router;
