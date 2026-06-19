import SeatComponent from './Seat.jsx';
import styles from './SeatGrid.module.css';

export default function SeatGrid({ seats, selectedSeats, onToggle, readOnly }) {
  // Group seats by row label
  const rowMap = seats.reduce((acc, seat) => {
    const row = seat.row || seat.seatNumber[0];
    if (!acc[row]) acc[row] = [];
    acc[row].push(seat);
    return acc;
  }, {});

  const rows = Object.keys(rowMap).sort();

  return (
    <div className={styles.wrapper}>
      <div className={styles.legend}>
        <span className={`${styles.dot} ${styles.available}`} /> Available
        <span className={`${styles.dot} ${styles.selected}`} /> Selected
        <span className={`${styles.dot} ${styles.reserved}`} /> Reserved (on hold)
        <span className={`${styles.dot} ${styles.booked}`} /> Booked
      </div>

      <div className={styles.grid}>
        <div className={styles.stage}>STAGE</div>
        {rows.map((row) => (
          <div key={row} className={styles.row}>
            <span className={styles.rowLabel}>{row}</span>
            <div className={styles.seats}>
              {rowMap[row].map((seat) => (
                <SeatComponent
                  key={seat._id}
                  seat={seat}
                  isSelected={selectedSeats.includes(seat.seatNumber)}
                  onToggle={onToggle}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
