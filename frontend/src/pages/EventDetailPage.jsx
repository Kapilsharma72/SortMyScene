import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axiosClient.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import SeatGrid from '../components/SeatGrid.jsx';
import BookingSummary from '../components/BookingSummary.jsx';
import ReservationTimer from '../components/ReservationTimer.jsx';
import styles from './EventDetailPage.module.css';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// Possible UI phases for this page
const PHASE = {
  SELECTING: 'selecting',
  CONFIRMING: 'confirming', // hold placed, waiting for confirmation
  SUCCESS: 'success',
};

export default function EventDetailPage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [reserving, setReserving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [phase, setPhase] = useState(PHASE.SELECTING);
  const [reservation, setReservation] = useState(null); // { reservationId, expiresAt, seatNumbers }
  const [bookingResult, setBookingResult] = useState(null);

  const pollRef = useRef(null);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchSeats = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${id}/seats`);
      setSeats(data.data);
    } catch {
      // Silent — stale data is better than a broken page during polling
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    // Always fetch event details + seat grid in parallel.
    // Additionally, if the user is authenticated, check whether they already
    // have an active reservation for this event (covers navigate-away/refresh).
    const baseRequests = [
      api.get(`/events/${id}`),
      api.get(`/events/${id}/seats`),
    ];
    const myResRequest = isAuthenticated
      ? api.get(`/events/${id}/my-reservation`).catch(() => ({ data: { data: null } }))
      : Promise.resolve({ data: { data: null } });

    Promise.all([...baseRequests, myResRequest])
      .then(([evRes, seatsRes, myResRes]) => {
        if (cancelled) return;
        setEvent(evRes.data.data);
        setSeats(seatsRes.data.data);

        const activeRes = myResRes.data.data;
        if (activeRes) {
          // Restore confirming mode: populate reservation state from the API,
          // not from localStorage — this is always the source of truth.
          setReservation({
            reservationId: activeRes.reservationId,
            seatNumbers: activeRes.seatNumbers,
            expiresAt: activeRes.expiresAt,
          });
          // Pre-mark those seats as selected so the summary panel matches.
          setSelectedSeats(activeRes.seatNumbers);
          setPhase(PHASE.CONFIRMING);
        }
        // If activeRes is null we stay in PHASE.SELECTING (the default).

        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to load event');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, isAuthenticated]);

  // Poll seat grid every 20s while in SELECTING phase, stop once a reservation is active
  useEffect(() => {
    if (phase !== PHASE.SELECTING) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(fetchSeats, 20000);

    // Also refetch when window regains focus
    const handleFocus = () => { if (phase === PHASE.SELECTING) fetchSeats(); };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [phase, fetchSeats]);

  // ─── Seat selection ───────────────────────────────────────────────────────

  const toggleSeat = (seatNumber) => {
    setSelectedSeats((prev) =>
      prev.includes(seatNumber)
        ? prev.filter((s) => s !== seatNumber)
        : [...prev, seatNumber]
    );
  };

  // ─── Reserve ──────────────────────────────────────────────────────────────

  const handleReserve = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/events/${id}` } } });
      return;
    }
    if (selectedSeats.length === 0) return;

    setReserving(true);
    try {
      const { data } = await api.post('/reserve', {
        eventId: id,
        seatNumbers: selectedSeats,
      });
      setReservation(data.data);
      setPhase(PHASE.CONFIRMING);
      addToast('Seats held for 10 minutes. Confirm your booking below.', 'info');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        const unavailable = err.response.data.unavailableSeats || [];
        addToast(
          `Seat(s) ${unavailable.join(', ')} were just taken. Please reselect.`,
          'warning',
          6000
        );
        // Refresh the grid immediately so the user sees current state
        await fetchSeats();
        // Clear any selected seats that are no longer available
        setSelectedSeats((prev) => prev.filter((s) => !unavailable.includes(s)));
      } else {
        addToast(err.response?.data?.message || 'Failed to reserve seats', 'error');
      }
    } finally {
      setReserving(false);
    }
  };

  // ─── Confirm ──────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const { data } = await api.post('/bookings', {
        reservationId: reservation.reservationId,
      });
      setBookingResult(data.data);
      setPhase(PHASE.SUCCESS);
      addToast('Booking confirmed!', 'success');
      // Final seat state refresh for accuracy
      await fetchSeats();
    } catch (err) {
      const status = err.response?.status;
      if (status === 410) {
        addToast('Your hold expired. Please pick your seats again.', 'warning');
        handleExpired();
      } else {
        addToast(err.response?.data?.message || 'Booking failed', 'error');
      }
    } finally {
      setConfirming(false);
    }
  };

  // Called both by the timer reaching 0 and by a 410 response.
  // Note: ReservationTimer's useEffect fires at most once (when expired flips to true),
  // so we don't need to guard against double-calls here.
  const handleExpired = useCallback(async () => {
    setPhase(PHASE.SELECTING);
    setReservation(null);
    setSelectedSeats([]);
    addToast('Your seat hold expired. Seats have been released.', 'warning');
    await fetchSeats();
  }, [fetchSeats, addToast]);

  // ─── Render helpers ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className={styles.page}>
        <div className="container">
          <div className={styles.loadingState}>
            <div className={`skeleton ${styles.skeletonTitle}`} />
            <div className={`skeleton ${styles.skeletonGrid}`} />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.page}>
        <div className="container">
          <div className={styles.centerState}>
            <p style={{ color: 'var(--danger)' }}>⚠️ {error}</p>
            <Link to="/events" className="btn btn-outline">Back to events</Link>
          </div>
        </div>
      </main>
    );
  }

  if (phase === PHASE.SUCCESS) {
    const ref = `SMB-${bookingResult.bookingId.toString().slice(-8).toUpperCase()}`;
    return (
      <main className={styles.page}>
        <div className="container">
          <div className={`${styles.successCard} fade-up`}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>Booking Confirmed!</h2>
            <p className={styles.successSub}>
              You're all set for <strong>{event.name}</strong>.
            </p>
            <div className={styles.refBox}>
              <span className={styles.refLabel}>Booking reference</span>
              <span className={styles.refCode}>{ref}</span>
            </div>
            <div className={styles.successSeats}>
              <span className={styles.refLabel}>Your seats</span>
              <div className={styles.seatTags}>
                {bookingResult.seatNumbers.map((s) => (
                  <span key={s} className={styles.seatTag}>{s}</span>
                ))}
              </div>
            </div>
            <Link to="/events" className="btn btn-primary" style={{ marginTop: '8px' }}>
              Browse more events
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { available = 0, reserved = 0, booked = 0 } = event.seatSummary || {};

  return (
    <main className={styles.page}>
      <div className="container">
        <Link to="/events" className={styles.back}>← All Events</Link>

        <div className={styles.layout}>
          {/* Left column: event info + seat grid */}
          <div className={styles.main}>
            <header className={styles.eventHeader}>
              <h1 className={styles.eventName}>{event.name}</h1>
              <div className={styles.eventMeta}>
                <span>📅 {formatDate(event.dateTime)}</span>
                <span>📍 {event.venue}</span>
                <span className={styles.price}>
                  {event.priceInINR > 0
                    ? `₹${event.priceInINR.toLocaleString('en-IN')} per seat`
                    : 'Free entry'}
                </span>
              </div>
              {event.description && (
                <p className={styles.description}>{event.description}</p>
              )}
              <div className={styles.seatStats}>
                <span className={`badge badge-success`}>{available} available</span>
                <span className={`badge badge-warning`}>{reserved} on hold</span>
                <span className={`badge badge-muted`}>{booked} booked</span>
              </div>
            </header>

            {phase === PHASE.CONFIRMING && (
              <div className={styles.timerRow}>
                <ReservationTimer
                  expiresAt={reservation.expiresAt}
                  onExpired={handleExpired}
                />
              </div>
            )}

            <SeatGrid
              seats={seats}
              selectedSeats={selectedSeats}
              onToggle={toggleSeat}
              readOnly={phase === PHASE.CONFIRMING}
            />
          </div>

          {/* Right column: summary + actions */}
          <aside className={styles.sidebar}>
            <BookingSummary
              selectedSeats={
                phase === PHASE.CONFIRMING ? reservation.seatNumbers : selectedSeats
              }
              priceInINR={event.priceInINR}
            />

            {phase === PHASE.SELECTING && (
              <>
                {!isAuthenticated && selectedSeats.length > 0 && (
                  <p className={styles.loginPrompt}>
                    <Link to="/login" state={{ from: { pathname: `/events/${id}` } }}>
                      Log in
                    </Link>{' '}
                    to reserve selected seats.
                  </p>
                )}
                <button
                  id="reserve-btn"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px' }}
                  disabled={selectedSeats.length === 0 || reserving}
                  onClick={handleReserve}
                >
                  {reserving
                    ? 'Reserving…'
                    : `Reserve ${selectedSeats.length > 0 ? `${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''}` : 'Selected Seats'}`}
                </button>
              </>
            )}

            {phase === PHASE.CONFIRMING && (
              <button
                id="confirm-btn"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '12px' }}
                disabled={confirming}
                onClick={handleConfirm}
              >
                {confirming ? 'Confirming…' : 'Confirm Booking'}
              </button>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
