import { Router } from 'express';
import { createInvitation, acceptInvitation } from '../controllers/invitationController';
import { requireRole } from '../middlewares/requireRole';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// POST /invitations — owner sends an invitation
router.post('/', requireRole('owner'), asyncHandler(createInvitation));

// POST /invitations/accept — anyone accepts via token (no auth required)
router.post('/accept', asyncHandler(acceptInvitation));

export default router;
