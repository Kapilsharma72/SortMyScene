/**
 * Concurrency test — proves double-booking is prevented at the DB level.
 *
 * Run with:   npm run test:concurrency
 * Requires:   backend dev server running on localhost:5000
 *
 * The script self-discovers a real eventId and an available seat so it
 * can be run immediately after seeding without any manual configuration.
 */

import 'dotenv/config';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api';

// Thin wrapper around built-in fetch that returns { status, data } and never throws.
async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const USER_A = { name: 'Concurrency Test A', email: 'concurrencytest1@test.com', password: 'Test1234!' };
const USER_B = { name: 'Concurrency Test B', email: 'concurrencytest2@test.com', password: 'Test1234!' };

// ── helpers ──────────────────────────────────────────────────────────────────

async function getToken(user) {
  // Try register first; fall back to login if the account already exists.
  const reg = await request('POST', '/auth/register', user);
  if (reg.status === 201) return reg.data.data.token;
  // Account exists from a previous run — just log in.
  const login = await request('POST', '/auth/login', { email: user.email, password: user.password });
  if (!login.data?.data?.token) throw new Error(`Login failed for ${user.email}: ${JSON.stringify(login.data)}`);
  return login.data.data.token;
}

async function reserve(label, token, eventId, seatNumber) {
  const res = await request('POST', '/reserve', { eventId, seatNumbers: [seatNumber] }, token);
  return { label, status: res.status, data: res.data };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(72));
  console.log('SortMyScene — Concurrency / Double-Booking Prevention Test');
  console.log('='.repeat(72));
  console.log(`Target API: ${BASE}\n`);

  // Step 1 — discover a real event
  const eventsRes = await request('GET', '/events');
  const events = eventsRes.data?.data;
  if (!events || events.length === 0) {
    console.error('ABORT: No events found. Run `npm run seed` first.');
    process.exit(1);
  }
  const event = events[0];
  console.log(`Event selected : "${event.name}" (${event._id})`);

  // Step 2 — find one available seat
  const seatsRes = await request('GET', `/events/${event._id}/seats`);
  const available = seatsRes.data?.data?.filter((s) => s.status === 'available') ?? [];
  if (available.length === 0) {
    console.error('ABORT: No available seats. Re-seed or pick a different event.');
    process.exit(1);
  }
  const seat = available[0];
  console.log(`Seat selected  : ${seat.seatNumber} (currently available)\n`);

  // Step 3 — obtain tokens for both test users
  console.log('Authenticating test users…');
  const [tokenA, tokenB] = await Promise.all([getToken(USER_A), getToken(USER_B)]);
  console.log(`  ${USER_A.email} → token obtained`);
  console.log(`  ${USER_B.email} → token obtained`);

  // Step 4 — fire BOTH reserve calls simultaneously
  console.log(`\nFiring simultaneous POST /reserve for seat ${seat.seatNumber}…`);
  const [resA, resB] = await Promise.all([
    reserve('User A', tokenA, event._id, seat.seatNumber),
    reserve('User B', tokenB, event._id, seat.seatNumber),
  ]);

  // Step 5 — print full response details for both
  console.log('\n' + '─'.repeat(72));
  console.log(`User A → HTTP ${resA.status}`);
  console.log(JSON.stringify(resA.data, null, 2));
  console.log('─'.repeat(72));
  console.log(`User B → HTTP ${resB.status}`);
  console.log(JSON.stringify(resB.data, null, 2));
  console.log('─'.repeat(72));

  // Step 6 — verdict
  const statuses = [resA.status, resB.status].sort((a, b) => a - b);
  const oneSucceeded = statuses[0] === 201 && statuses[1] === 409;

  // Extra check: the 409 body should mention the seat
  const loser = resA.status === 409 ? resA : resB;
  const seatMentioned =
    JSON.stringify(loser.data).includes(seat.seatNumber) ||
    loser.data?.message?.toLowerCase().includes('unavailable') ||
    loser.data?.message?.toLowerCase().includes('no longer available') ||
    Array.isArray(loser.data?.unavailableSeats);

  if (oneSucceeded && seatMentioned) {
    console.log('\n✓ PASS — exactly one request got 201, the other got 409.');
    console.log('  Double-booking is correctly prevented at the database level.');
  } else if (oneSucceeded && !seatMentioned) {
    console.log('\n⚠ PARTIAL PASS — status codes are correct (201 + 409), but the');
    console.log('  409 body does not explicitly mention the conflicting seat number.');
  } else if (statuses[0] === 201 && statuses[1] === 201) {
    console.log('\n✗ FAIL — BOTH requests returned 201. Double-booking occurred!');
    process.exit(1);
  } else if (statuses[0] === 409 && statuses[1] === 409) {
    console.log('\n✗ FAIL — BOTH requests returned 409. Something is wrong with the');
    console.log('  reserve endpoint itself (neither succeeded).');
    process.exit(1);
  } else {
    console.log(`\n✗ FAIL — unexpected status pair: ${resA.status} / ${resB.status}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\nTest script crashed:', err.message);
  process.exit(1);
});
