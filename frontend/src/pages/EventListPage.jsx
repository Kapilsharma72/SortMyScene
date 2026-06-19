import { useEffect, useState } from 'react';
import api from '../api/axiosClient.js';
import EventCard from '../components/EventCard.jsx';
import styles from './EventListPage.module.css';

export default function EventListPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/events')
      .then(({ data }) => {
        if (!cancelled) {
          setEvents(Array.isArray(data.data) ? data.data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load events');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.header}>
          <h1 className={styles.heading}>Upcoming Events</h1>
          <p className={styles.sub}>
            Browse events and pick your seats before they're gone.
          </p>
        </header>

        {loading && (
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className={styles.state}>
            <p className={styles.errorText}>⚠️ {error}</p>
            <button
              className="btn btn-outline"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className={styles.state}>
            <p className={styles.emptyText}>No upcoming events right now. Check back soon.</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className={styles.grid}>
            {events.map((event) => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
