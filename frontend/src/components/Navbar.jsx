import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully', 'info');
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to="/events" className={styles.brand}>
          <span className={styles.brandAccent}>Sort</span>MyScene
        </Link>

        <div className={styles.actions}>
          {isAuthenticated ? (
            <>
              <span className={styles.greeting}>Hi, {user.name.split(' ')[0]}</span>
              <button className="btn btn-outline" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline">Log in</Link>
              <Link to="/register" className="btn btn-primary">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
