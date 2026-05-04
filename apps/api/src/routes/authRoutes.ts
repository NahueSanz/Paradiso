import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { asyncHandler } from '../utils/asyncHandler';

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados registros. Intentá de nuevo en 1 hora.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados intentos. Por favor esperá 15 minutos e intentá de nuevo.' },
});

const router = Router();

router.post('/register',             registerLimiter,       asyncHandler(register));
router.post('/login',                                       asyncHandler(login));
router.post('/forgot-password',      forgotPasswordLimiter, asyncHandler(forgotPassword));
router.post('/reset-password',                             asyncHandler(resetPassword));

export default router;
