import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  seatNumbers: { type: [String], required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'completed'],
    default: 'active',
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL index: MongoDB will eventually delete expired documents as a backstop.
// This does NOT atomically release the seats — that's handled by the cron job
// in jobs/expireReservations.js and the defensive check in bookingController.
reservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Reservation', reservationSchema);
