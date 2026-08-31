import { getDB } from '../../config/db';
import { PlatformSettings, DEFAULT_PLATFORM_SETTINGS, RetentionPolicy, DriveAutomationConfig } from './platformSettings.types';

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
    },
    ai: {
      vision: {
        ...DEFAULT_PLATFORM_SETTINGS.ai!.vision,
        ...(settings.ai?.vision || {}),
        providers: {
          groq: {
            ...DEFAULT_PLATFORM_SETTINGS.ai!.vision.providers.groq,
            ...(settings.ai?.vision?.providers?.groq || {})
          },
          gemini: {
            ...DEFAULT_PLATFORM_SETTINGS.ai!.vision.providers.gemini,
            ...(settings.ai?.vision?.providers?.gemini || {})
          }
        }
      },
      caption: {
        ...DEFAULT_PLATFORM_SETTINGS.ai!.caption,
        ...(settings.ai?.caption || {}),
        providers: {
          groq: {
            ...DEFAULT_PLATFORM_SETTINGS.ai!.caption.providers.groq,
            ...(settings.ai?.caption?.providers?.groq || {})
          },
          gemini: {
            ...DEFAULT_PLATFORM_SETTINGS.ai!.caption.providers.gemini,
            ...(settings.ai?.caption?.providers?.gemini || {})
          }
        }
      }
    },
    driveAutomation: {
      ...DEFAULT_PLATFORM_SETTINGS.driveAutomation!,
      ...(settings.driveAutomation || {})
    },
    autoSync: {
      ...DEFAULT_PLATFORM_SETTINGS.autoSync!,
      ...(settings.autoSync || {})
    }
  };

  return normalizedSettings;
};

export const updatePlatformSettings = async (
  updates: { 
    retention?: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy };
    sync?: { staleRun?: { enabled?: boolean; timeoutMinutes?: number } };
    ai?: {
      vision?: {
        primaryProvider?: 'groq' | 'gemini';
        fallbackProvider?: 'groq' | 'gemini';
        providers?: {
          groq?: { models?: string[] };
          gemini?: { models?: string[] };
        };
      };
      caption?: {
        primaryProvider?: 'groq' | 'gemini';
        fallbackProvider?: 'groq' | 'gemini';
        providers?: {
          groq?: { models?: string[] };
          gemini?: { models?: string[] };
        };
      };
    };
    driveAutomation?: Partial<DriveAutomationConfig>;
    autoSync?: {
      enabled?: boolean;
    };
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

  const newAi = {
    vision: {
      ...existing.ai!.vision,
      ...(updates.ai?.vision || {}),
      providers: {
        groq: {
          ...existing.ai!.vision.providers.groq,
          ...(updates.ai?.vision?.providers?.groq || {})
        },
        gemini: {
          ...existing.ai!.vision.providers.gemini,
          ...(updates.ai?.vision?.providers?.gemini || {})
        }
      }
    },
    caption: {
      ...existing.ai!.caption,
      ...(updates.ai?.caption || {}),
      providers: {
        groq: {
          ...existing.ai!.caption.providers.groq,
          ...(updates.ai?.caption?.providers?.groq || {})
        },
        gemini: {
          ...existing.ai!.caption.providers.gemini,
          ...(updates.ai?.caption?.providers?.gemini || {})
        }
      }
    }
  };

  const newDriveAutomation = {
    ...existing.driveAutomation,
    ...(updates.driveAutomation || {})
  } as DriveAutomationConfig;

  const newAutoSync = {
    ...(existing.autoSync || DEFAULT_PLATFORM_SETTINGS.autoSync!),
    ...(updates.autoSync || {})
  };

  const result = await db.collection<PlatformSettings>('platformSettings').findOneAndUpdate(
    { _id: GLOBAL_SETTINGS_ID },
    {
      $set: {
        retention: newRetention,
        sync: newSync,
        ai: newAi,
        driveAutomation: newDriveAutomation,
        autoSync: newAutoSync,
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
