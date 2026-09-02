import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { getDB } from '../../config/db';
import {
  AutomationJob,
  EnqueueJobParams,
  EnqueueJobResult,
  HeavyJobStatus,
} from './automationJob.types';
import { SyncRun } from '../sync/sync.types';
import {
  createSyncRun,
  buildSyncPlan,
  triggerSync,
  updateSyncRunToFailed,
} from '../sync/sync.service';
import { getPlatformSettings } from '../platformSettings/platformSettings.service';

export const getRunningHeavyJob = async (): Promise<AutomationJob | null> => {
  const db = getDB();
  return db.collection<AutomationJob>('automationJobs').findOne({ status: 'running' });
};

export const getJobById = async (jobId: string | ObjectId): Promise<AutomationJob | null> => {
  const db = getDB();
  return db.collection<AutomationJob>('automationJobs').findOne({ _id: new ObjectId(jobId) });
};

export const getJobByReferenceId = async (
  referenceId: string | ObjectId
): Promise<AutomationJob | null> => {
  const db = getDB();
  return db.collection<AutomationJob>('automationJobs').findOne({
    referenceId: new ObjectId(referenceId),
  });
};

export const enqueueAutomationJob = async (
  params: EnqueueJobParams
): Promise<EnqueueJobResult> => {
  const db = getDB();

  // For LEAD_AUTO: Check if an active/pending job for the same targetDate already exists
  if (params.jobType === 'LEAD_AUTO' && params.targetDate) {
    const existing = await db.collection<AutomationJob>('automationJobs').findOne({
      jobType: 'LEAD_AUTO',
      targetDate: params.targetDate,
      status: { $in: ['pending', 'running'] },
    });

    if (existing) {
      return {
        job: existing,
        isCoalesced: true,
      };
    }
  }

  const newJob: AutomationJob = {
    jobType: params.jobType,
    status: 'pending',
    priority: params.priority,
    ...(params.targetDate ? { targetDate: params.targetDate } : {}),
    triggeredBy: params.triggeredBy,
    ...(params.referenceId ? { referenceId: params.referenceId } : {}),
    payload: params.payload || {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await db.collection<AutomationJob>('automationJobs').insertOne(newJob);
    return {
      job: { ...newJob, _id: result.insertedId },
      isCoalesced: false,
    };
  } catch (err: any) {
    // Catch duplicate key error on LEAD_AUTO coalescing index
    if (err.code === 11000 && params.jobType === 'LEAD_AUTO' && params.targetDate) {
      const existing = await db.collection<AutomationJob>('automationJobs').findOne({
        jobType: 'LEAD_AUTO',
        targetDate: params.targetDate,
        status: { $in: ['pending', 'running'] },
      });
      if (existing) {
        return {
          job: existing,
          isCoalesced: true,
        };
      }
    }
    throw err;
  }
};

export const acquireGlobalHeavyLock = async (
  jobId: ObjectId | string
): Promise<boolean> => {
  const db = getDB();
  try {
    const result = await db.collection<AutomationJob>('automationJobs').findOneAndUpdate(
      {
        _id: new ObjectId(jobId),
        status: 'pending',
      },
      {
        $set: {
          status: 'running',
          lockKey: 'global-heavy-lock',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
    return !!result;
  } catch (err: any) {
    if (err.code === 11000) {
      // Global lock already held by another running job
      return false;
    }
    throw err;
  }
};

export const updateAutomationJobReference = async (
  jobId: ObjectId | string,
  referenceId: ObjectId
): Promise<boolean> => {
  const db = getDB();
  const result = await db.collection<AutomationJob>('automationJobs').updateOne(
    { _id: new ObjectId(jobId) },
    { $set: { referenceId, updatedAt: new Date() } }
  );
  return result.modifiedCount > 0;
};

export const releaseHeavyJobLock = async (
  jobId: ObjectId | string,
  finalStatus: HeavyJobStatus,
  options?: { errorMessage?: string }
): Promise<boolean> => {
  const db = getDB();
  const update: any = {
    $set: {
      status: finalStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
      ...(options?.errorMessage ? { errorMessage: options.errorMessage } : {}),
    },
    $unset: {
      lockKey: '',
    },
  };

  const result = await db.collection<AutomationJob>('automationJobs').updateOne(
    { _id: new ObjectId(jobId), status: 'running' },
    update
  );

  if (result.modifiedCount > 0) {
    setImmediate(() => {
      dispatchNextHeavyJob().catch((err) => {
        console.error('[JobQueue] Error dispatching next heavy job:', err);
      });
    });
    return true;
  }

  return false;
};

export const releaseHeavyJobLockByReference = async (
  referenceId: ObjectId | string,
  finalStatus: HeavyJobStatus,
  options?: { errorMessage?: string }
): Promise<boolean> => {
  const db = getDB();
  const update: any = {
    $set: {
      status: finalStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
      ...(options?.errorMessage ? { errorMessage: options.errorMessage } : {}),
    },
    $unset: {
      lockKey: '',
    },
  };

  const result = await db.collection<AutomationJob>('automationJobs').updateOne(
    { referenceId: new ObjectId(referenceId), status: 'running' },
    update
  );

  if (result.modifiedCount > 0) {
    setImmediate(() => {
      dispatchNextHeavyJob().catch((err) => {
        console.error('[JobQueue] Error dispatching next heavy job:', err);
      });
    });
    return true;
  }

  return false;
};

export const getNextPendingJob = async (): Promise<AutomationJob | null> => {
  const db = getDB();
  return db.collection<AutomationJob>('automationJobs').findOne(
    { status: 'pending' },
    { sort: { priority: -1, createdAt: 1 } }
  );
};

export const claimNextPendingJob = async (): Promise<AutomationJob | null> => {
  const db = getDB();
  try {
    const result = await db.collection<AutomationJob>('automationJobs').findOneAndUpdate(
      {
        status: 'pending',
      },
      {
        $set: {
          status: 'running',
          lockKey: 'global-heavy-lock',
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      {
        sort: { priority: -1, createdAt: 1 },
        returnDocument: 'after',
      }
    );
    return result;
  } catch (err: any) {
    if (err.code === 11000) {
      return null;
    }
    throw err;
  }
};

export const executePostSyncJob = async (job: AutomationJob): Promise<void> => {
  const { targetDate, triggeredBy, payload } = job;
  if (!targetDate) {
    await releaseHeavyJobLock(job._id!, 'failed', {
      errorMessage: 'Missing targetDate for POST_SYNC job',
    });
    return;
  }

  try {
    const retryOf = payload?.retryOf;
    const syncId = await createSyncRun(targetDate, triggeredBy, retryOf);
    await updateAutomationJobReference(job._id!, syncId);

    const settings = await getPlatformSettings();
    let syncPlan = payload?.syncPlan;
    if (!syncPlan && !retryOf) {
      const planResult = await buildSyncPlan(targetDate);
      syncPlan = planResult.syncPlan;
    }

    const triggerPayload = {
      targetDate,
      triggeredBy,
      requestId: crypto.randomUUID(),
      syncId: syncId.toString(),
      aiConfig: settings.ai,
      ...(syncPlan ? { syncPlan } : {}),
      ...(payload?.retryItems ? { retryItems: payload.retryItems } : {}),
    };

    await triggerSync(triggerPayload);
  } catch (error: any) {
    if (job.referenceId) {
      await updateSyncRunToFailed(
        job.referenceId.toString(),
        'Sync workflow could not be started.'
      );
    }
    await releaseHeavyJobLock(job._id!, 'failed', {
      errorMessage: 'Sync workflow could not be started.',
    });
  }
};

export const dispatchNextHeavyJob = async (): Promise<AutomationJob | null> => {
  const running = await getRunningHeavyJob();
  if (running) {
    return null;
  }

  const claimedJob = await claimNextPendingJob();
  if (!claimedJob) {
    return null;
  }

  if (claimedJob.jobType === 'POST_SYNC') {
    executePostSyncJob(claimedJob).catch((err) => {
      console.error(
        `[JobQueue] Failed to execute dispatched POST_SYNC job ${claimedJob._id}:`,
        err
      );
    });
  } else if (
    claimedJob.jobType === 'LEAD_AUTO' ||
    claimedJob.jobType === 'LEAD_MANUAL'
  ) {
    console.log(
      `[JobQueue] Dispatched ${claimedJob.jobType} job ${claimedJob._id} (Lead execution worker to be wired in lead milestone)`
    );
  }

  return claimedJob;
};

export const resolveStaleHeavyJobs = async ({
  timeoutMinutes,
}: {
  timeoutMinutes: number;
}) => {
  const db = getDB();
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  const collection = db.collection<AutomationJob>('automationJobs');

  const filter = {
    status: 'running' as const,
    createdAt: { $lt: cutoff },
  };

  const staleJobs = await collection.find(filter).toArray();
  if (staleJobs.length === 0) {
    return { resolvedCount: 0 };
  }

  const result = await collection.updateMany(filter, {
    $set: {
      status: 'incomplete',
      completedAt: new Date(),
      updatedAt: new Date(),
      errorMessage:
        'Job automatically marked incomplete after exceeding the configured running timeout.',
    },
    $unset: {
      lockKey: '',
    },
  });

  const syncRunsCollection = db.collection<SyncRun>('syncRuns');
  for (const job of staleJobs) {
    if (job.referenceId && job.jobType === 'POST_SYNC') {
      await syncRunsCollection.updateOne(
        { _id: job.referenceId, status: 'running' },
        {
          $set: {
            status: 'incomplete',
            completedAt: new Date(),
            updatedAt: new Date(),
            result: {
              success: false,
              status: 'INCOMPLETE',
              targetDate: job.targetDate || '',
              message:
                'Sync automatically marked incomplete after exceeding the configured running timeout.',
              resolutionReason: 'STALE_TIMEOUT',
            },
          },
        }
      );
    }
  }

  setImmediate(() => {
    dispatchNextHeavyJob().catch((err) => {
      console.error('[JobQueue] Error dispatching after stale resolution:', err);
    });
  });

  return { resolvedCount: result.modifiedCount };
};
