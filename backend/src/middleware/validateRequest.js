import { validationResult } from 'express-validator';
import { AppError } from '../utils/AppError.js';

// Runs after express-validator chains — if there are errors, formats them
// and throws an AppError so the central handler returns a consistent shape.
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors
      .array()
      .map((e) => e.msg)
      .join('; ');
    return next(new AppError(message, 400));
  }
  next();
};

export default validateRequest;
