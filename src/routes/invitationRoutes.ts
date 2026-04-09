import { Router } from 'express';
import { createInvitation, acceptInvitation } from '../controllers/invitationController';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

// POST /invitations — owner sends an invitation
router.post('/', requireRole('owner'), createInvitation);

// POST /invitations/accept — anyone accepts via token (no auth required)
router.post('/accept', acceptInvitation);

export default router;
