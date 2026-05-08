import { Router } from 'express';
import { getMessages, postMessage } from '../controllers/chatController';
import { resolveMembership } from '../middlewares/resolveMembership';

const router = Router();

router.use(resolveMembership);

router.get('/messages',  getMessages);
router.post('/messages', postMessage);

export default router;
