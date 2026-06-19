import { Router } from 'express';
import { createReservation } from '../controllers/reservationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import validateRequest from '../middleware/validateRequest.js';
import { reserveValidators } from '../validators/reservationValidators.js';

const router = Router();

router.post('/', authMiddleware, reserveValidators, validateRequest, createReservation);

export default router;
