import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';
import Seat from '../models/Seat.js';
import { AppError } from '../utils/AppError.js';

export const confirmBooking = async (req, res, next) => {
  const { reservationId } = req.body;

  // Fetch fresh from DB every time — never trust a cached/previous check.
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    return next(new AppError('Reservation not found', 404));
  }

  // Ownership check before we reveal any status info
  if (reservation.userId.toString() !== req.user._id.toString()) {
    return next(new AppError('This reservation does not belong to you', 403));
  }

  // Belt-and-suspenders expiry check: catches the window between the cron's
  // last sweep and now, where the reservation expired but the cron hasn't run yet.
  const isExpired =
    reservation.status === 'expired' ||
    reservation.status === 'completed' ||
    reservation.expiresAt < new Date();

  if (isExpired) {
    return res.status(410).json({
      success: false,
      message: 'Reservation expired, please reserve again',
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Move all the seats from 'reserved' to 'booked'
    await Seat.updateMany(
      {
        eventId: reservation.eventId,
        seatNumber: { $in: reservation.seatNumbers },
        status: 'reserved',
      },
      { $set: { status: 'booked' } },
      { session }
    );

    reservation.status = 'completed';
    await reservation.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: {
        bookingId: reservation._id,
        status: 'completed',
        seatNumbers: reservation.seatNumbers,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};
