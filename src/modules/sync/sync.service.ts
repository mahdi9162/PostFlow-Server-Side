import { ObjectId } from 'mongodb';
import { env } from '../../config/env';
import { getDB } from '../../config/db';
import { SyncRun, SyncRunResult } from './sync.types';

interface SyncRequestPayload {
  targetDate: string;
  triggeredBy: string;
  requestId: string;
  syncId: string;
  aiConfig: any; // Using any or importing AiTaskConfig from platformSettings.types.ts
  retryItems?: any[];
}

export const createSyncRun = async (targetDate: string, triggeredBy: string, retryOf?: string): Promise<ObjectId> => {
  const db = getDB();
  const newSyncRun: SyncRun = {
    targetDate,
    status: 'running',
    triggeredBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(retryOf ? { retryOf } : {}),
  };

  const result = await db.collection<SyncRun>('syncRuns').insertOne(newSyncRun);
  return result.insertedId;
};

export const getSyncRunById = async (syncId: string): Promise<SyncRun | null> => {
  const db = getDB();
  return db.collection<SyncRun>('syncRuns').findOne({ _id: new ObjectId(syncId) });
};

export const getPaginatedSyncHistory = async (page: number, limit: number) => {
  const db = getDB();
  const skip = (page - 1) * limit;

  const [runs, totalCount] = await Promise.all([
    db.collection<SyncRun>('syncRuns')
      .find({}, { projection: { 'result.accounts': 0, 'result.failedItems': 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection<SyncRun>('syncRuns').countDocuments()
  ]);

  return { runs, totalCount };
};

export const updateSyncRunToFailed = async (syncId: string, errorMessage: string): Promise<boolean> => {
  const db = getDB();
  const update = {
    $set: {
      status: 'failed' as const,
      errorMessage,
      updatedAt: new Date(),
      completedAt: new Date(),
    },
  };
  const result = await db.collection<SyncRun>('syncRuns').updateOne({ _id: new ObjectId(syncId), status: 'running' }, update);
  return result.modifiedCount > 0;
};

export const updateSyncRunToFinalized = async (
  syncId: string,
  status: 'completed' | 'partial_success' | 'failed' | 'incomplete',
  resultData: SyncRunResult
): Promise<boolean> => {
  const db = getDB();
  const update = {
    $set: {
      status,
      result: resultData,
      updatedAt: new Date(),
      completedAt: new Date(),
    },
  };
  const result = await db.collection<SyncRun>('syncRuns').updateOne({ _id: new ObjectId(syncId), status: 'running' }, update);
  return result.modifiedCount > 0;
};

export const triggerSync = async (payload: SyncRequestPayload): Promise<void> => {
  const { N8N_POSTFLOW_WEBHOOK_URL, N8N_POSTFLOW_WEBHOOK_KEY } = env;

  if (!N8N_POSTFLOW_WEBHOOK_URL || !N8N_POSTFLOW_WEBHOOK_KEY) {
    throw new Error('Sync configuration is missing on the server.');
  }

  const signal = AbortSignal.timeout(10000); // 10 seconds timeout for quick acknowledgement

  let response;
  try {
    response = await fetch(N8N_POSTFLOW_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PostFlow-Webhook-Key': N8N_POSTFLOW_WEBHOOK_KEY,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error: any) {
    throw new Error('Sync workflow could not be started.');
  }

  if (!response.ok) {
    throw new Error('Sync workflow could not be started.');
  }

  // Quick acknowledgement received; do not wait for the final summary.
};
