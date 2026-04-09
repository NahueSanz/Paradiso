import { Router } from 'express';
import { createCourt, deleteCourt, getCourts, updateCourt } from '../controllers/courtController';
import { requireRole } from '../middlewares/requireRole';

const router = Router();

router.get('/', getCourts);
router.post('/', requireRole('owner'), createCourt);
router.patch('/:id', requireRole('owner'), updateCourt);
router.delete('/:id', requireRole('owner'), deleteCourt);

export default router;
