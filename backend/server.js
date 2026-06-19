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
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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
