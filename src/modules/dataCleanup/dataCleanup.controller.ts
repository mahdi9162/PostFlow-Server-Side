import { Request, Response } from 'express';
import { runCleanup } from './dataCleanup.service';
import { getDB } from '../../config/db';
import crypto from 'crypto';

export const runScheduledCleanup = async (req: Request, res: Response) => {
  const db = getDB();
  const locksCollection = db.collection('locks');
  const LOCK_ID = 'data-cleanup-cron';
  const STALE_LOCK_MINUTES = 60;

  const now = new Date();
  const expiryTime = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1000);
  const ownerId = crypto.randomUUID();

  let lockAcquired = false;

  try {
    await locksCollection.findOneAndUpdate(
      {
        _id: LOCK_ID as any,
        $or: [
          { lockedAt: null },
          { lockedAt: { $exists: false } },
          { lockedAt: { $lt: expiryTime } }
        ]
      },
      {
        $set: { lockedAt: now, ownerId }
      },
      { upsert: true, returnDocument: 'after' }
    );
    lockAcquired = true;
  } catch (err: any) {
    if (err.code === 11000) {
      lockAcquired = false;
    } else {
      console.error('Error acquiring cleanup lock', err);
      return res.status(500).json({ message: 'Internal server error acquiring lock' });
    }
  }

  if (!lockAcquired) {
    console.log('Cleanup skipped: Lock is already active.');
    return res.status(409).json({ message: 'Cleanup skipped because lock is active.' });
  }

  try {
    console.log('Scheduled cleanup started.');

    let syncHistoryResult;
    let postsResult;

    try {
      syncHistoryResult = await runCleanup({ target: 'syncHistory', dryRun: false });
    } catch (error: any) {
      console.error('syncHistory cleanup failed:', error);
      syncHistoryResult = { success: false, error: error.message };
    }

    try {
      postsResult = await runCleanup({ target: 'posts', dryRun: false });
    } catch (error: any) {
      console.error('posts cleanup failed:', error);
      postsResult = { success: false, error: error.message };
    }

    console.log('Scheduled cleanup completed.');

    return res.status(200).json({
      message: 'Scheduled cleanup completed',
      results: {
        syncHistory: syncHistoryResult,
        posts: postsResult,
      },
    });
  } finally {
    try {
      await locksCollection.updateOne(
        { _id: LOCK_ID as any, ownerId },
        { $set: { lockedAt: null, ownerId: null } }
      );
    } catch (err) {
      console.error('Failed to release cleanup lock', err);
    }
  }
};
