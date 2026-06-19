import { useEffect, useState } from 'react';

// Derives remaining seconds from the actual expiresAt timestamp rather than
// counting down from a static initial value. This means if the tab goes to
// background and comes back, the remaining time will be accurate rather than
// frozen at the last rendered value.
export default function useCountdown(expiresAt) {
  const getRemainingSeconds = () => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState(getRemainingSeconds);

  useEffect(() => {
    if (!expiresAt) return;

    setSecondsLeft(getRemainingSeconds());

    const interval = setInterval(() => {
      const remaining = getRemainingSeconds();
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const expired = secondsLeft <= 0 && !!expiresAt;

  return { secondsLeft, display, expired };
}
