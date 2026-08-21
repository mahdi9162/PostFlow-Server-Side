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
  
  return settings;
};

export const updatePlatformSettings = async (
  retentionUpdates: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy }
): Promise<PlatformSettings> => {
  const db = getDB();
  const now = new Date();

  const existing = await getPlatformSettings();

  const newRetention = {
    syncHistory: { ...existing.retention.syncHistory, ...(retentionUpdates.syncHistory || {}) },
    posts: { ...existing.retention.posts, ...(retentionUpdates.posts || {}) },
  };

  const result = await db.collection<PlatformSettings>('platformSettings').findOneAndUpdate(
    { _id: GLOBAL_SETTINGS_ID },
    {
      $set: {
        retention: newRetention,
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
