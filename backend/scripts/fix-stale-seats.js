import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const SeatSchema = new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  seatNumber: String,
  row: String,
  status: String,
  reservationId: { type: mongoose.Schema.Types.ObjectId, default: null },
});
const ReservationSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  eventId: mongoose.Schema.Types.ObjectId,
  seatNumbers: [String],
  status: String,
  expiresAt: Date,
});

const Seat = mongoose.model('Seat', SeatSchema);
const Reservation = mongoose.model('Reservation', ReservationSchema);

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB');

const staleSeats = await Seat.find({ status: 'reserved' });
console.log(`Found ${staleSeats.length} reserved seat(s) to check`);

let released = 0;
for (const seat of staleSeats) {
  let isActive = false;
  if (seat.reservationId) {
    const res = await Reservation.findOne({
      _id: seat.reservationId,
      status: 'active',
      expiresAt: { $gt: new Date() },
    });
    isActive = !!res;
  }
  if (!isActive) {
    await Seat.updateOne(
      { _id: seat._id },
      { $set: { status: 'available', reservationId: null } }
    );
    console.log(`  Released stale seat: ${seat.seatNumber}`);
    released++;
  } else {
    console.log(`  Seat ${seat.seatNumber} has a valid active reservation — skipping`);
  }
}

// Also mark any expired-but-still-active reservations as expired
const expiredRes = await Reservation.updateMany(
  { status: 'active', expiresAt: { $lt: new Date() } },
  { $set: { status: 'expired' } }
);
console.log(`\nMarked ${expiredRes.modifiedCount} stale reservation(s) as expired`);
console.log(`Released ${released} stale seat(s). All done.`);

await mongoose.disconnect();
