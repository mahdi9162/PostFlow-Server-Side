import { getDB } from '../../config/db';
import { getPlatformSettings } from '../platformSettings/platformSettings.service';
import { CleanupOptions, CleanupResult, CleanupSample, CleanupTarget } from './dataCleanup.types';
import { Filter } from 'mongodb';
import { SyncRun } from '../sync/sync.types';
import { Post } from '../post/post.types';

const buildSyncHistoryFilter = (cutoff: Date): Filter<SyncRun> => {
  return {
    status: { $in: ['completed', 'partial_success', 'failed', 'incomplete'] },
    $or: [
      { completedAt: { $lt: cutoff } },
      { completedAt: { $exists: false }, createdAt: { $lt: cutoff } },
    ],
  };
};

const buildPostsFilter = (cutoff: Date): Filter<Post> => {
  return {
    status: 'posted',
    $or: [
      { postedAt: { $lt: cutoff } },
      { postedAt: { $exists: false }, createdAt: { $lt: cutoff } },
    ],
  };
};

export const runCleanup = async (options: CleanupOptions): Promise<CleanupResult> => {
  const settings = await getPlatformSettings();
  const db = getDB();
  const { target, dryRun } = options;

  let enabled = false;
  let retentionDays = 90;
  let filter: any = {};
  let collectionName = '';

  if (target === 'syncHistory') {
    enabled = settings.retention.syncHistory.enabled;
    retentionDays = settings.retention.syncHistory.retentionDays;
    collectionName = 'syncRuns';
  } else if (target === 'posts') {
    enabled = settings.retention.posts.enabled;
    retentionDays = settings.retention.posts.retentionDays;
    collectionName = 'posts';
  } else {
    throw new Error('Invalid cleanup target');
  }

  if (typeof retentionDays !== 'number' || isNaN(retentionDays) || retentionDays < 1) {
    throw new Error(`Invalid retentionDays for target ${target}: ${retentionDays}`);
  }

  if (!enabled) {
    return {
      target,
      dryRun: !!dryRun,
      enabled: false,
      message: 'Retention cleanup is disabled',
    };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  if (target === 'syncHistory') {
    filter = buildSyncHistoryFilter(cutoff);
  } else {
    filter = buildPostsFilter(cutoff);
  }

  const collection = db.collection(collectionName);
  
  if (dryRun === false) {
    const deleteResult = await collection.deleteMany(filter);
    
    return {
      target,
      dryRun: false,
      enabled: true,
      retentionDays,
      cutoff,
      deletedCount: deleteResult.deletedCount,
    };
  } else {
    const eligibleCount = await collection.countDocuments(filter);
    const rawSample = await collection.find(filter).limit(5).toArray();
    
    const sample: CleanupSample[] = rawSample.map((doc: any) => ({
      id: doc._id.toString(),
      status: doc.status,
      createdAt: doc.createdAt,
      completedAt: doc.completedAt,
      postedAt: doc.postedAt,
    }));

    return {
      target,
      dryRun: true,
      enabled: true,
      retentionDays,
      cutoff,
      eligibleCount,
      sample,
    };
  }
};
