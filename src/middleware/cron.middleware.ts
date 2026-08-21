import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import crypto from 'crypto';

export const verifyCronSecret = (req: Request, res: Response, next: NextFunction) => {
  if (!env.CRON_SECRET) {
    return res.status(503).json({ message: 'CRON_SECRET is not configured on this server.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: Missing or malformed Bearer token' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  const serverKeyBuffer = Buffer.from(env.CRON_SECRET);
  const requestKeyBuffer = Buffer.from(token);

  if (serverKeyBuffer.length !== requestKeyBuffer.length) {
    return res.status(401).json({ message: 'Unauthorized: Invalid cron secret' });
  }

  if (!crypto.timingSafeEqual(serverKeyBuffer, requestKeyBuffer)) {
    return res.status(401).json({ message: 'Unauthorized: Invalid cron secret' });
  }

  next();
};
