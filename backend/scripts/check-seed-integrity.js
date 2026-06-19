/**
 * Seed integrity check:
 * Verifies that every Event's totalSeats field matches the actual
 * number of Seat documents in the database for that event.
 */
import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const Event = mongoose.model('Event', new mongoose.Schema({
  name: String,
  totalSeats: Number,
  rows: Number,
  seatsPerRow: Number,
}));

const Seat = mongoose.model('Seat', new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  seatNumber: String,
  row: String,
  status: String,
}));

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected to MongoDB\n');

const events = await Event.find().sort({ name: 1 });

console.log('='.repeat(72));
console.log('Seed Integrity Check — totalSeats vs actual Seat documents');
console.log('='.repeat(72));

let allPass = true;

for (const ev of events) {
  const actualCount  = await Seat.countDocuments({ eventId: ev._id });
  const rowsXcols    = ev.rows * ev.seatsPerRow;
  const match        = actualCount === ev.totalSeats;
  const rowMatch     = rowsXcols  === ev.totalSeats;
  const status       = match ? '✓' : '✗';

  console.log(`\n${status} "${ev.name}"`);
  console.log(`  totalSeats field   : ${ev.totalSeats}`);
  console.log(`  rows × seatsPerRow : ${ev.rows} × ${ev.seatsPerRow} = ${rowsXcols}`);
  console.log(`  actual Seat docs   : ${actualCount}`);
  console.log(`  fields consistent  : ${match && rowMatch ? 'YES' : 'NO ← MISMATCH'}`);

  if (!match || !rowMatch) allPass = false;
}

console.log('\n' + '─'.repeat(72));
console.log(allPass
  ? '✓ ALL PASS — totalSeats matches actual seat count for every event.'
  : '✗ MISMATCH FOUND — see details above.');
console.log('─'.repeat(72));

await mongoose.disconnect();
if (!allPass) process.exit(1);
