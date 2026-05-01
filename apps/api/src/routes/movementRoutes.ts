import { Router } from 'express';
import { listMovements, createManual, createSale, cancelMovement, deleteMovement } from '../controllers/movementController';

const router = Router();

router.get('/',             listMovements);
router.post('/manual',      createManual);
router.post('/sale',        createSale);
router.patch('/:id/cancel', cancelMovement);
router.delete('/:id',       deleteMovement);

export default router;
