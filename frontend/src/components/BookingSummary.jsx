import styles from './BookingSummary.module.css';

export default function BookingSummary({ selectedSeats, priceInINR }) {
  const total = selectedSeats.length * priceInINR;

  if (selectedSeats.length === 0) {
    return (
      <div className={styles.empty}>
        Select seats from the grid to see your order summary.
      </div>
    );
  }

  return (
    <div className={styles.summary}>
      <h3 className={styles.heading}>Order Summary</h3>

      <div className={styles.seats}>
        {selectedSeats.map((s) => (
          <span key={s} className={styles.seatTag}>{s}</span>
        ))}
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span>Seats</span>
          <span>{selectedSeats.length}</span>
        </div>
        <div className={styles.row}>
          <span>Price per seat</span>
          <span>{priceInINR > 0 ? `₹${priceInINR.toLocaleString('en-IN')}` : 'Free'}</span>
        </div>
      </div>

      <div className={styles.total}>
        <span>Total</span>
        <span className={styles.totalAmount}>
          {total > 0 ? `₹${total.toLocaleString('en-IN')}` : 'Free'}
        </span>
      </div>
    </div>
  );
}
