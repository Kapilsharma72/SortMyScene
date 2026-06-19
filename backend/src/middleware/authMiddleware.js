import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication token required', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }
    req.user = user;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};

export default authMiddleware;
