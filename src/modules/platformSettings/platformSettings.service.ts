import { getDB } from '../../config/db';
import { PlatformSettings, DEFAULT_PLATFORM_SETTINGS, RetentionPolicy } from './platformSettings.types';

const GLOBAL_SETTINGS_ID = 'global';

export const getPlatformSettings = async (): Promise<PlatformSettings> => {
  const db = getDB();
  const settings = await db.collection<PlatformSettings>('platformSettings').findOne({ _id: GLOBAL_SETTINGS_ID });
  
  if (!settings) {
    return {
      ...DEFAULT_PLATFORM_SETTINGS,
      _id: GLOBAL_SETTINGS_ID,
    } as PlatformSettings;
  }
  
  // Normalize settings with defaults for missing fields
  const normalizedSettings: PlatformSettings = {
    ...settings,
    retention: {
      syncHistory: {
        ...DEFAULT_PLATFORM_SETTINGS.retention.syncHistory,
        ...(settings.retention?.syncHistory || {})
      },
      posts: {
        ...DEFAULT_PLATFORM_SETTINGS.retention.posts,
        ...(settings.retention?.posts || {})
      }
    },
    sync: {
      staleRun: {
        ...DEFAULT_PLATFORM_SETTINGS.sync!.staleRun!,
        ...(settings.sync?.staleRun || {})
      }
    }
  };

  return normalizedSettings;
};

export const updatePlatformSettings = async (
  updates: { 
    retention?: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy };
    sync?: { staleRun?: { enabled?: boolean; timeoutMinutes?: number } };
  }
): Promise<PlatformSettings> => {
  const db = getDB();
  const now = new Date();

  const existing = await getPlatformSettings();

  const newRetention = {
    syncHistory: { ...existing.retention.syncHistory, ...(updates.retention?.syncHistory || {}) },
    posts: { ...existing.retention.posts, ...(updates.retention?.posts || {}) },
  };

  const newSync = {
    ...existing.sync,
    staleRun: {
      ...(existing.sync?.staleRun || DEFAULT_PLATFORM_SETTINGS.sync!.staleRun!),
      ...(updates.sync?.staleRun || {})
    }
  };

  const result = await db.collection<PlatformSettings>('platformSettings').findOneAndUpdate(
    { _id: GLOBAL_SETTINGS_ID },
    {
      $set: {
        retention: newRetention,
        sync: newSync,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result as PlatformSettings;
};
