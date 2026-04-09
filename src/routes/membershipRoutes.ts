import { Router } from 'express';
import { getMembership, updateMembership } from '../controllers/membershipController';

const router = Router();

router.get('/', getMembership);
router.patch('/:id', updateMembership);

export default router;
