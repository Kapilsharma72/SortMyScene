import cron from 'node-cron';
import mongoose from 'mongoose';
import Reservation from '../models/Reservation.js';
import Seat from '../models/Seat.js';

// Runs every 30 seconds. Finds active reservations past their expiry time,
// releases their seats atomically, and marks the reservation as expired.
//
// The TTL index on Reservation.expiresAt is a backstop for document cleanup,
// but it can't atomically release seats — that's what this job does.
// The booking controller also does a defensive expiry check on every request
// (belt-and-suspenders), so even if this cron fires slightly late, a
// user can't confirm an expired reservation.
const startExpiryJob = () => {
  cron.schedule('*/30 * * * * *', async () => {
    const now = new Date();
    const expired = await Reservation.find({
      status: 'active',
      expiresAt: { $lt: now },
    });

    if (expired.length === 0) return;

    console.log(`[expiry-cron] Found ${expired.length} reservation(s) to expire`);

    for (const reservation of expired) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Seat.updateMany(
          {
            eventId: reservation.eventId,
            seatNumber: { $in: reservation.seatNumbers },
            status: 'reserved', // reservationId filter hata diya — naye seed ke baad _id match nahi karta
          },
          { $set: { status: 'available', reservationId: null } },
          { session }
        );

        reservation.status = 'expired';
        await reservation.save({ session });

        await session.commitTransaction();
        console.log(`[expiry-cron] Expired reservation ${reservation._id}`);
      } catch (err) {
        await session.abortTransaction();
        console.error(`[expiry-cron] Failed to expire ${reservation._id}:`, err.message);
      } finally {
        session.endSession();
      }
    }
  });

  console.log('Reservation expiry cron started (every 30s)');
};

export default startExpiryJob;
