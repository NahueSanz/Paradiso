import { Router } from 'express';
import { createClub, getClubs, updateClub } from '../controllers/clubController';
import { inviteToClub } from '../controllers/invitationController';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/', getClubs);
router.post('/', requireRole('owner'), createClub);
router.patch('/:id', requireRole('owner'), updateClub);
router.post('/:clubId/invite', requireRole('owner'), inviteToClub);

export default router;
