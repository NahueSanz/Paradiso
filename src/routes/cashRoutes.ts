import { Router } from 'express';
import { getCashMovements, postCashMovement } from '../controllers/cashController';

const router = Router();

router.get('/',  getCashMovements);
router.post('/', postCashMovement);

export default router;
