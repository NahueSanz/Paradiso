import { Router } from 'express';
import { createCourt, getCourts } from '../controllers/courtController';

const router = Router();

router.get('/', getCourts);
router.post('/', createCourt);

export default router;
