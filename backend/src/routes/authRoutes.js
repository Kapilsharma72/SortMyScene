import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { registerValidators, loginValidators } from '../validators/authValidators.js';
import validateRequest from '../middleware/validateRequest.js';

const router = Router();

router.post('/register', registerValidators, validateRequest, register);
router.post('/login', loginValidators, validateRequest, login);

export default router;
