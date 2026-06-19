import { Router } from 'express';
import { listEvents, getEvent, getEventSeats, getMyReservation } from '../controllers/eventController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Public endpoints — browsing doesn't require auth
router.get('/', listEvents);
router.get('/:id', getEvent);
router.get('/:id/seats', getEventSeats);

// Auth-required — returns the calling user's active reservation for this event (or null)
router.get('/:id/my-reservation', authMiddleware, getMyReservation);

export default router;

