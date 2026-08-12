import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import crypto from 'crypto';

export const verifyInternalApiKey = (req: Request, res: Response, next: NextFunction) => {
  if (!env.INTERNAL_API_KEY) {
    return res.status(503).json({ message: 'Internal automation authentication is not configured.' });
  }

  const internalApiKey = req.headers['x-internal-api-key'];

  if (!internalApiKey || typeof internalApiKey !== 'string') {
    return res.status(401).json({ message: 'Unauthorized: Missing internal API key' });
  }

  const serverKeyBuffer = Buffer.from(env.INTERNAL_API_KEY);
  const requestKeyBuffer = Buffer.from(internalApiKey);

  if (serverKeyBuffer.length !== requestKeyBuffer.length) {
    return res.status(401).json({ message: 'Unauthorized: Invalid internal API key' });
  }

  if (!crypto.timingSafeEqual(serverKeyBuffer, requestKeyBuffer)) {
    return res.status(401).json({ message: 'Unauthorized: Invalid internal API key' });
  }

  next();
};
