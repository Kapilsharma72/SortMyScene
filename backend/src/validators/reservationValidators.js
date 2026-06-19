import { body } from 'express-validator';
import mongoose from 'mongoose';

const isObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid ID format');
  }
  return true;
};

export const reserveValidators = [
  body('eventId')
    .notEmpty()
    .withMessage('eventId is required')
    .custom(isObjectId),
  body('seatNumbers')
    .isArray({ min: 1 })
    .withMessage('seatNumbers must be a non-empty array'),
  body('seatNumbers.*')
    .isString()
    .notEmpty()
    .withMessage('Each seat number must be a non-empty string'),
  body('seatNumbers').custom((seats) => {
    if (new Set(seats).size !== seats.length) {
      throw new Error('seatNumbers must not contain duplicates');
    }
    return true;
  }),
];

export const bookingValidators = [
  body('reservationId')
    .notEmpty()
    .withMessage('reservationId is required')
    .custom(isObjectId),
];
