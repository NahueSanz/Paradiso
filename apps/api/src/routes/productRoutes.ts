import { Router } from 'express';
import { listProducts, createProduct, updateProduct, deleteProduct, sellProduct } from '../controllers/productController';
import { resolveMembership, requireOwnerMembership } from '../middlewares/resolveMembership';

const router = Router();

router.use(resolveMembership);

router.get('/', listProducts);
router.post('/sell', sellProduct);
router.post('/', requireOwnerMembership, createProduct);
router.put('/:id', requireOwnerMembership, updateProduct);
router.delete('/:id', requireOwnerMembership, deleteProduct);

export default router;
