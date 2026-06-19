import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dateTime: { type: Date, required: true },
  venue: { type: String, required: true, trim: true },
  totalSeats: { type: Number, required: true },
  rows: { type: Number },
  seatsPerRow: { type: Number },
  priceInINR: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Event', eventSchema);
