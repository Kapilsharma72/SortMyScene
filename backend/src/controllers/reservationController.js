import mongoose from 'mongoose';
import Seat from '../models/Seat.js';
import Event from '../models/Event.js';
import Reservation from '../models/Reservation.js';
import { AppError } from '../utils/AppError.js';

export const createReservation = async (req, res, next) => {
  const { eventId, seatNumbers } = req.body;
  const holdMinutes = parseInt(process.env.RESERVATION_HOLD_MINUTES, 10) || 10;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify event exists before touching seats
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      return next(new AppError('Event not found', 404));
    }

    // Verify all requested seat numbers actually exist for this event
    const existingSeats = await Seat.find({
      eventId,
      seatNumber: { $in: seatNumbers },
    }).session(session);

    if (existingSeats.length !== seatNumbers.length) {
      const foundNumbers = existingSeats.map((s) => s.seatNumber);
      const missing = seatNumbers.filter((n) => !foundNumbers.includes(n));
      await session.abortTransaction();
      return next(new AppError(`Seat(s) not found for this event: ${missing.join(', ')}`, 404));
    }

    // THE CRITICAL PART: atomic conditional update.
    // We only update seats whose status is CURRENTLY 'available'.
    // If another request grabbed a seat between our read and this write,
    // the modifiedCount won't match and we abort — no double booking.
    const updateResult = await Seat.updateMany(
      { eventId, seatNumber: { $in: seatNumbers }, status: 'available' },
      { $set: { status: 'reserved' } },
      { session }
    );

    if (updateResult.modifiedCount !== seatNumbers.length) {
      // At least one seat wasn't available at the moment of the write.
      // Re-query (within the same session/snapshot) to tell the client exactly which ones.
      const takenSeats = await Seat.find({
        eventId,
        seatNumber: { $in: seatNumbers },
        status: { $ne: 'available' },
      })
        .select('seatNumber status')
        .session(session);

      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: 'One or more selected seats are no longer available',
        unavailableSeats: takenSeats.map((s) => s.seatNumber),
      });
    }

    // Seats locked — create the reservation document
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    const [reservation] = await Reservation.create(
      [{ userId: req.user._id, eventId, seatNumbers, expiresAt }],
      { session }
    );

    // Stamp the reservationId back onto each seat so expiry can clean up by it
    await Seat.updateMany(
      { eventId, seatNumber: { $in: seatNumbers } },
      { $set: { reservationId: reservation._id } },
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: {
        reservationId: reservation._id,
        seatNumbers: reservation.seatNumbers,
        expiresAt: reservation.expiresAt,
      },
    });
  } catch (err) {
    await session.abortTransaction();

    // MongoDB throws a WriteConflict (code 112, label TransientTransactionError)
    // when two concurrent transactions try to modify the same document(s).
    // This is the correct atomic rejection — surface it as a 409 so the client
    // knows to prompt the user to reselect rather than showing a generic error.
    const isWriteConflict =
      err.code === 112 ||
      err.errorLabels?.includes('TransientTransactionError') ||
      err.errorLabelSet?.has('TransientTransactionError');

    if (isWriteConflict) {
      return res.status(409).json({
        success: false,
        message: 'One or more selected seats are no longer available',
        unavailableSeats: seatNumbers,
      });
    }

    next(err);
  } finally {
    session.endSession();
  }
};
