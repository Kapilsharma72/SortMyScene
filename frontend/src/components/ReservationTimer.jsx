import { useEffect } from 'react';
import useCountdown from '../hooks/useCountdown.js';
import styles from './ReservationTimer.module.css';

export default function ReservationTimer({ expiresAt, onExpired }) {
  const { display, secondsLeft, expired } = useCountdown(expiresAt);
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  // Notify parent once when the countdown hits zero — so the UI reverts to
  // selection mode proactively, before the user clicks Confirm and gets a 410.
  useEffect(() => {
    if (expired && onExpired) {
      onExpired();
    }
  }, [expired, onExpired]);

  return (
    <div className={`${styles.timer} ${isUrgent ? styles.urgent : ''}`}>
      <span className={styles.label}>Hold expires in</span>
      <span className={styles.clock}>{display}</span>
    </div>
  );
}
