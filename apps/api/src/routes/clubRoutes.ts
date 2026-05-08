import { Router } from 'express';
import { createClub, getClubs, updateClub, getClubMembers } from '../controllers/clubController';
import { inviteToClub } from '../controllers/invitationController';
import { requireRole } from '../middlewares/requireRole';
import { resolveMembership } from '../middlewares/resolveMembership';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// 👀 READ (guest allowed, but can personalize if logged in)
router.get('/', asyncHandler(getClubs));

// 🔒 OWNER ONLY — club-scoped (requires X-Club-Id header)
router.get('/members', resolveMembership, asyncHandler(getClubMembers));

// 🔒 OWNER ONLY
router.post('/', requireRole('owner'), asyncHandler(createClub));
router.patch('/:id', requireRole('owner'), asyncHandler(updateClub));
router.post('/:clubId/invite', requireRole('owner'), asyncHandler(inviteToClub));

export default router;