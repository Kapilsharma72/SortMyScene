import mongoose from 'mongoose';

const seatSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true,
  },
  seatNumber: { type: String, required: true },
  row: { type: String },
  status: {
    type: String,
    enum: ['available', 'reserved', 'booked'],
    default: 'available',
  },
  reservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reservation',
    default: null,
  },
});

// Compound unique index: same seat number can't exist twice for the same event
seatSchema.index({ eventId: 1, seatNumber: 1 }, { unique: true });

export default mongoose.model('Seat', seatSchema);
