/**
 * Tests two edge cases:
 * 11. Expired JWT token → should get clean 401, not crash
 * 12. Non-existent seatNumber → should get clean 404, not 500
 */
import 'dotenv/config';
import dns from 'dns';
import jwt from 'jsonwebtoken';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const BASE = 'http://localhost:5000/api';

async function req(method, path, body, token) {
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

function separator(label) {
  console.log('\n' + '='.repeat(72));
  console.log(label);
  console.log('='.repeat(72));
}

async function run() {
  // ── Get a real eventId first ───────────────────────────────────────────────
  const evRes = await req('GET', '/events');
  const event = evRes.data?.data?.[0];
  if (!event) { console.error('ABORT: No events. Run npm run seed first.'); process.exit(1); }
  console.log(`Using event: "${event.name}" (${event._id})`);

  // ── Get a valid token first so we know the user/secret work ───────────────
  await req('POST', '/auth/register', { name: 'EdgeTest', email: 'edgetest@test.com', password: 'Test1234!' });
  const loginRes = await req('POST', '/auth/login', { email: 'edgetest@test.com', password: 'Test1234!' });
  const validToken = loginRes.data?.data?.token;
  if (!validToken) { console.error('ABORT: Could not get a valid token.', loginRes.data); process.exit(1); }

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 11: Expired JWT
  // ══════════════════════════════════════════════════════════════════════════
  separator('TEST 11: Expired JWT → POST /api/reserve');

  // Sign a token with the SAME secret but expiresIn=0 (already expired)
  const expiredToken = jwt.sign(
    { id: 'fakeuserid123' },
    process.env.JWT_SECRET,
    { expiresIn: 0 }  // expires immediately — already invalid by the time it's verified
  );
  console.log(`Expired token (first 40 chars): ${expiredToken.substring(0, 40)}...`);

  const r11 = await req('POST', '/reserve', { eventId: event._id, seatNumbers: ['A1'] }, expiredToken);
  console.log(`\nHTTP Status : ${r11.status}`);
  console.log('Response   :', JSON.stringify(r11.data, null, 2));

  const pass11 = r11.status === 401 && r11.data?.success === false && r11.data?.message;
  console.log(pass11
    ? '\n✓ PASS — Got clean 401 with message. No crash, no 500.'
    : '\n✗ FAIL — Expected 401, got ' + r11.status);

  // ══════════════════════════════════════════════════════════════════════════
  // TEST 12: Non-existent seatNumber
  // ══════════════════════════════════════════════════════════════════════════
  separator('TEST 12: Non-existent seatNumber → POST /api/reserve');

  const fakeSeat = 'Z99';  // definitely doesn't exist in any event
  console.log(`Sending seatNumber: "${fakeSeat}" (does not exist in the event)`);

  const r12 = await req('POST', '/reserve', { eventId: event._id, seatNumbers: [fakeSeat] }, validToken);
  console.log(`\nHTTP Status : ${r12.status}`);
  console.log('Response   :', JSON.stringify(r12.data, null, 2));

  const pass12 = (r12.status === 404 || r12.status === 400) && r12.data?.success === false;
  console.log(pass12
    ? `\n✓ PASS — Got clean ${r12.status} with message. No crash, no 500.`
    : '\n✗ FAIL — Expected 404/400, got ' + r12.status);

  // ── Final verdict ─────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(72));
  console.log(`Test 11 (Expired JWT)         : ${pass11 ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Test 12 (Invalid seatNumber)  : ${pass12 ? '✓ PASS' : '✗ FAIL'}`);
  console.log('─'.repeat(72));

  if (!pass11 || !pass12) process.exit(1);
}

run().catch((err) => {
  console.error('\nTest script crashed:', err.message);
  process.exit(1);
});
