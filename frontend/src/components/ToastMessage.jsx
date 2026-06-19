import { useEffect } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import styles from './ToastMessage.module.css';

export default function ToastMessage() {
  const { toasts, removeToast } = useToast();

  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          role="alert"
        >
          <span className={styles.message}>{toast.message}</span>
          <button
            className={styles.close}
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
