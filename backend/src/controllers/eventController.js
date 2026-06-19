import Event from '../models/Event.js';
import Seat from '../models/Seat.js';
import Reservation from '../models/Reservation.js';
import { AppError } from '../utils/AppError.js';

export const listEvents = async (req, res, next) => {
  try {
    const events = await Event.find().sort({ dateTime: 1 }).lean();

    // Single aggregation to get seat counts for ALL events — no N+1 queries
    const seatCounts = await Seat.aggregate([
      {
        $group: {
          _id: { eventId: '$eventId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build a lookup map: eventId → { available, reserved, booked }
    const countMap = {};
    for (const { _id, count } of seatCounts) {
      const key = _id.eventId.toString();
      if (!countMap[key]) countMap[key] = { available: 0, reserved: 0, booked: 0 };
      if (_id.status === 'available') countMap[key].available = count;
      if (_id.status === 'reserved')  countMap[key].reserved  = count;
      if (_id.status === 'booked')    countMap[key].booked    = count;
    }

    const data = events.map((ev) => ({
      ...ev,
      seatSummary: countMap[ev._id.toString()] ?? { available: 0, reserved: 0, booked: 0 },
    }));

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};


export const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return next(new AppError('Event not found', 404));

    const [available, reserved, booked] = await Promise.all([
      Seat.countDocuments({ eventId: event._id, status: 'available' }),
      Seat.countDocuments({ eventId: event._id, status: 'reserved' }),
      Seat.countDocuments({ eventId: event._id, status: 'booked' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...event.toObject(),
        seatSummary: { available, reserved, booked },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getEventSeats = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return next(new AppError('Event not found', 404));

    const seats = await Seat.find({ eventId: event._id })
      .select('_id seatNumber row status')
      .sort({ row: 1, seatNumber: 1 });

    res.status(200).json({ success: true, data: seats });
  } catch (err) {
    next(err);
  }
};

// GET /api/events/:id/my-reservation  (auth required)
// Returns the caller's active, non-expired reservation for this event,
// or { data: null } if none exists. Never returns 404 — "no reservation"
// is a normal state, not an error.
export const getMyReservation = async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      eventId: req.params.id,
      userId: req.user._id,
      status: 'active',
      expiresAt: { $gt: new Date() },
    }).select('_id seatNumbers expiresAt');

    if (!reservation) {
      return res.status(200).json({ success: true, data: null });
    }

    res.status(200).json({
      success: true,
      data: {
        reservationId: reservation._id,
        seatNumbers: reservation.seatNumbers,
        expiresAt: reservation.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

