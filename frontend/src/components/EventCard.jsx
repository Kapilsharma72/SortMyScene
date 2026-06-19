import { Link } from 'react-router-dom';
import styles from './EventCard.module.css';

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function EventCard({ event }) {
  const { _id, name, dateTime, venue, totalSeats, priceInINR, seatSummary } = event;
  const available = seatSummary?.available ?? totalSeats;
  const pctLeft = Math.round((available / totalSeats) * 100);

  let availBadge = 'badge-success';
  if (pctLeft < 25) availBadge = 'badge-warning';
  if (available === 0) availBadge = 'badge-muted';

  return (
    <Link to={`/events/${_id}`} className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.name}>{name}</h2>
        <span className={`badge ${availBadge}`}>
          {available === 0 ? 'Sold out' : `${available} left`}
        </span>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.icon}>📅</span>
          <span>{formatDate(dateTime)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.icon}>📍</span>
          <span>{venue}</span>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.price}>
          {priceInINR > 0 ? `₹${priceInINR.toLocaleString('en-IN')}` : 'Free'}
        </span>
        <span className={styles.cta}>View seats →</span>
      </div>
    </Link>
  );
}
