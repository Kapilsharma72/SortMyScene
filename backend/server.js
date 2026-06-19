import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import eventRoutes from './src/routes/eventRoutes.js';
import reservationRoutes from './src/routes/reservationRoutes.js';
import bookingRoutes from './src/routes/bookingRoutes.js';
import errorMiddleware from './src/middleware/errorMiddleware.js';
import startExpiryJob from './src/jobs/expireReservations.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Support multiple CORS origins (comma-separated in env)
// Always include the production Vercel frontend as a fallback
const PRODUCTION_ORIGINS = [
  'https://sort-my-scene-ashen.vercel.app',
  'http://localhost:5173',
];

const envOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

const allowedOrigins = Array.from(new Set([...PRODUCTION_ORIGINS, ...envOrigins]));

console.log('Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin header)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/reserve', reservationRoutes);
app.use('/api/bookings', bookingRoutes);

// Catch-all for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use(errorMiddleware);

connectDB().then(() => {
  startExpiryJob();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
