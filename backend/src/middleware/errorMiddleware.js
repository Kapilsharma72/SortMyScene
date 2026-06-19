// Central error handler — all thrown AppErrors and unexpected errors land here.
// This keeps controllers clean: they just throw, never manually res.json error shapes.
const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  if (!err.isOperational) {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

export default errorMiddleware;
