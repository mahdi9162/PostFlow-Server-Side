import { Request, Response } from 'express';
import crypto from 'crypto';
import catchAsync from '../../utils/catchAsync';
import { findUserByFirebaseUid } from '../user/user.service';
import { validateAndDeriveDay } from '../post/post.helper';
import { triggerSync } from './sync.service';

export const prepareSync = catchAsync(async (req: Request, res: Response) => {
  const { targetDate } = req.body;

  if (!targetDate || typeof targetDate !== 'string') {
    return res.status(400).json({ message: 'targetDate is required and must be a string' });
  }

  const day = validateAndDeriveDay(targetDate);
  if (!day) {
    return res.status(400).json({ message: 'Invalid targetDate format or impossible date' });
  }

  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || (user.role !== 'admin' && user.role !== 'creator')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const payload = {
    targetDate,
    triggeredBy: user.email || uid,
    requestId: crypto.randomUUID(),
  };

  const result = await triggerSync(payload);
  return res.status(200).json(result);
});
