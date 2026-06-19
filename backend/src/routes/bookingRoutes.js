import { Router } from 'express';
import { confirmBooking } from '../controllers/bookingController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import validateRequest from '../middleware/validateRequest.js';
import { bookingValidators } from '../validators/reservationValidators.js';

const router = Router();

router.post('/', authMiddleware, bookingValidators, validateRequest, confirmBooking);

export default router;
