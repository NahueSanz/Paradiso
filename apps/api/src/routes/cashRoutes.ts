import { Router } from 'express';
import { getCashMovements, postCashMovement } from '../controllers/cashController';
import { listProducts, sellProduct } from '../controllers/productController';

const router = Router();

router.get('/',         getCashMovements);
router.post('/',        postCashMovement);
router.get('/products', listProducts);
router.post('/sell',    sellProduct);

export default router;
