import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';
import Event from '../src/models/Event.js';
import Seat from '../src/models/Seat.js';

// Node.js's internal DNS resolver fails on SRV lookups on some Windows setups.
// Forcing Google's public DNS fixes querySrv ETIMEOUT without changing the URI.
dns.setServers(['8.8.8.8', '8.8.4.4']);

const EVENTS = [
  {
    name: 'Prateek Kuhad Live in Concert',
    description:
      'An intimate evening with Prateek Kuhad performing songs from Cold/Mess and In Tokens & Charms, with a full acoustic band.',
    dateTime: new Date('2026-08-02T19:30:00'),
    venue: 'Bhartiya City Clubhouse, Bangalore',
    totalSeats: 50,
    rows: 5,
    seatsPerRow: 10,
    priceInINR: 1999,
  },
  {
    name: 'The Comedy Store: Stand-Up Showcase',
    description:
      'Three headline comedians from the Mumbai circuit in one night — sharp observational comedy, no filter.',
    dateTime: new Date('2026-07-18T20:00:00'),
    venue: 'Canvas Laugh Club, Lower Parel, Mumbai',
    totalSeats: 30,
    rows: 3,
    seatsPerRow: 10,
    priceInINR: 799,
  },
  {
    name: 'JSConf India 2026',
    description:
      'A full-day JavaScript conference with talks on performance, edge computing, and the state of the web platform. Includes workshop sessions and open-source networking.',
    dateTime: new Date('2026-09-13T09:00:00'),
    venue: 'NIMHANS Convention Centre, Bangalore',
    totalSeats: 80,
    rows: 8,
    seatsPerRow: 10,
    priceInINR: 2499,
  },
  {
    name: 'Mughal-E-Azam: The Musical',
    description:
      'The legendary epic reimagined as a Broadway-style musical in Urdu and Hindi, with live orchestra and original costumes.',
    dateTime: new Date('2026-07-25T18:30:00'),
    venue: 'NCPA Tata Theatre, Marine Lines, Mumbai',
    totalSeats: 60,
    rows: 6,
    seatsPerRow: 10,
    priceInINR: 1499,
  },
];

const ROW_LABELS = 'ABCDEFGHIJ';

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, {
    tlsAllowInvalidCertificates: true,
  });
  console.log('Connected to MongoDB');

  // Wipe events and seats only — leave users intact
  await Event.deleteMany({});
  await Seat.deleteMany({});
  console.log('Cleared existing events and seats');

  for (const eventData of EVENTS) {
    const event = await Event.create(eventData);
    console.log(`Created event: "${event.name}" (${event._id})`);

    const seats = [];
    for (let r = 0; r < event.rows; r++) {
      const rowLabel = ROW_LABELS[r];
      for (let s = 1; s <= event.seatsPerRow; s++) {
        seats.push({
          eventId: event._id,
          seatNumber: `${rowLabel}${s}`,
          row: rowLabel,
          status: 'available',
        });
      }
    }

    await Seat.insertMany(seats);
    console.log(`  → Created ${seats.length} seats (rows ${ROW_LABELS[0]}–${ROW_LABELS[event.rows - 1]}, ${event.seatsPerRow} per row)`);
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
