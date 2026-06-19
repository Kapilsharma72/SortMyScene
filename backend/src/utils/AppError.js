// Simple AppError class — controllers throw this, the central error
// handler catches it and returns the right status + envelope.
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
