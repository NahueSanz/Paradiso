import { Router } from 'express';
import { listProducts, createProduct, updateProduct, deleteProduct, sellProduct } from '../controllers/productController';

const router = Router();

router.get('/', listProducts);
router.post('/sell', sellProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
