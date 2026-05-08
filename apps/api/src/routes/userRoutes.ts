import { Router } from 'express';
import { updateMe } from '../controllers/userController';

const router = Router();

router.patch('/me', updateMe);

export default router;
