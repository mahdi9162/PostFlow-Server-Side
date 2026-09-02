import { getDB } from '../../config/db';
import { getPlatformSettings } from '../platformSettings/platformSettings.service';
import { SyncRun } from './sync.types';
import { resolveStaleHeavyJobs } from '../automationJob/automationJob.service';

export const resolveStaleSyncRuns = async ({ dryRun }: { dryRun: boolean }) => {
  const settings = await getPlatformSettings();
  const staleRunConfig = settings.sync?.staleRun;

  if (!staleRunConfig || staleRunConfig.enabled === false) {
    return {
      enabled: false,
      timeoutMinutes: staleRunConfig?.timeoutMinutes ?? 30,
      staleCount: 0,
      message: 'Stale sync auto-resolution is disabled',
    };
  }

  const { timeoutMinutes } = staleRunConfig;

  if (
    typeof timeoutMinutes !== 'number' ||
    !Number.isInteger(timeoutMinutes) ||
    timeoutMinutes < 5 ||
    timeoutMinutes > 1440
  ) {
    throw new Error('Invalid staleRun timeoutMinutes configuration in database');
  }

  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  const db = getDB();
  const collection = db.collection<SyncRun>('syncRuns');

  const filter = {
    status: 'running' as const,
    createdAt: { $lt: cutoff },
  };

  if (dryRun) {
    const staleCount = await collection.countDocuments(filter);

    // Max 5 samples
    const sampleDocs = await collection
      .find(filter)
      .project({ _id: 1, targetDate: 1, createdAt: 1, triggeredBy: 1 })
      .limit(5)
      .toArray();

    const sample = sampleDocs.map((doc) => ({
      id: doc._id.toString(),
      targetDate: doc.targetDate,
      createdAt: doc.createdAt,
      triggeredBy: doc.triggeredBy,
    }));

    return {
      enabled: true,
      timeoutMinutes,
      cutoff,
      staleCount,
      sample,
    };
  }

  // Execute mode:
  // 1. Resolve stale heavy automation jobs and linked sync runs
  await resolveStaleHeavyJobs({ timeoutMinutes });

  // 2. Resolve any remaining unlinked/legacy running syncRuns
  const result = await collection.updateMany(filter, [
    {
      $set: {
        status: 'incomplete',
        completedAt: '$$NOW',
        updatedAt: '$$NOW',
        result: {
          success: false,
          status: 'INCOMPLETE',
          targetDate: '$targetDate',
          message:
            'Sync automatically marked incomplete after exceeding the configured running timeout.',
          resolutionReason: 'STALE_TIMEOUT',
        },
      },
    },
  ]);

  return {
    enabled: true,
    timeoutMinutes,
    cutoff,
    resolvedCount: result.modifiedCount,
  };
};
