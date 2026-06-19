import styles from './Seat.module.css';

export default function Seat({ seat, isSelected, onToggle, readOnly }) {
  const { seatNumber, status } = seat;
  const isClickable = status === 'available' && !readOnly;

  const handleClick = () => {
    if (isClickable) onToggle(seatNumber);
  };

  const stateClass = isSelected
    ? styles.selected
    : styles[status]; // available | reserved | booked

  return (
    <button
      id={`seat-${seatNumber}`}
      className={`${styles.seat} ${stateClass} ${!isClickable ? styles.disabled : ''}`}
      onClick={handleClick}
      disabled={!isClickable}
      aria-label={`Seat ${seatNumber} — ${isSelected ? 'selected' : status}`}
      title={`${seatNumber} (${isSelected ? 'selected' : status})`}
    >
      {seatNumber}
    </button>
  );
}
