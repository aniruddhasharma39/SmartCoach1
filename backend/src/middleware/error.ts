import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err);

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => e.message).join('; ');
    return res.status(400).json({
      error: 'Validation Error',
      message: message || 'Validation failed',
      details: err.errors,
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : (err.name || 'Error'),
    message: err.message,
  });
}
