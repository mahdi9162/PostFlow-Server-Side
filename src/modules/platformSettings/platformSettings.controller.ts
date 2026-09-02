import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { resolveStaleSyncRuns } from '../sync/staleSync.service';
import { findUserByFirebaseUid } from '../user/user.service';
import { getPlatformSettings, updatePlatformSettings } from './platformSettings.service';
import { RetentionPolicy, DriveAutomationConfig, LeadFinderConfig } from './platformSettings.types';
import { runCleanup } from '../dataCleanup/dataCleanup.service';
import { CleanupTarget } from '../dataCleanup/dataCleanup.types';
import { isValidIanaTimezone, isValidTimeFormat } from '../../utils/timezone.helper';

const isValidRetentionPolicy = (policy: any): boolean => {
  if (typeof policy !== 'object' || policy === null || Array.isArray(policy)) return false;

  if (policy.enabled !== undefined) {
    if (typeof policy.enabled !== 'boolean') return false;
  }

  if (policy.retentionDays !== undefined) {
    if (typeof policy.retentionDays !== 'number') return false;
    if (!Number.isInteger(policy.retentionDays)) return false;
    if (policy.retentionDays < 1 || policy.retentionDays > 3650) return false;
  }

  return true;
};

const requireAdminAccess = async (req: Request, res: Response): Promise<boolean> => {
  const uid = req.user?.uid;
  if (!uid) {
    res.status(401).json({ message: 'Unauthorized' });
    return false;
  }

  const user = await findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || user.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden: Admin access required' });
    return false;
  }

  return true;
};

const isValidTarget = (target: string): target is CleanupTarget => {
  return target === 'syncHistory' || target === 'posts';
};

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const settings = await getPlatformSettings();
  return res.status(200).json(settings);
});

export const getInternalSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await getPlatformSettings();
  return res.status(200).json(settings);
});

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const { retention, sync, ai, driveAutomation, autoSync, leadFinder } = req.body;
  if (retention !== undefined && (typeof retention !== 'object' || Array.isArray(retention))) {
    return res.status(400).json({ message: 'Invalid payload: retention must be an object' });
  }
  if (sync !== undefined && (typeof sync !== 'object' || Array.isArray(sync))) {
    return res.status(400).json({ message: 'Invalid payload: sync must be an object' });
  }
  if (ai !== undefined && (typeof ai !== 'object' || Array.isArray(ai))) {
    return res.status(400).json({ message: 'Invalid payload: ai must be an object' });
  }
  if (driveAutomation !== undefined && (typeof driveAutomation !== 'object' || Array.isArray(driveAutomation))) {
    return res.status(400).json({ message: 'Invalid payload: driveAutomation must be an object' });
  }
  if (autoSync !== undefined && (typeof autoSync !== 'object' || Array.isArray(autoSync))) {
    return res.status(400).json({ message: 'Invalid payload: autoSync must be an object' });
  }
  if (leadFinder !== undefined && (typeof leadFinder !== 'object' || Array.isArray(leadFinder))) {
    return res.status(400).json({ message: 'Invalid payload: leadFinder must be an object' });
  }

  const updates: {
    retention?: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy };
    sync?: { staleRun?: { enabled?: boolean; timeoutMinutes?: number } };
    ai?: {
      vision?: any;
      caption?: any;
    };
    driveAutomation?: Partial<DriveAutomationConfig>;
    autoSync?: { enabled?: boolean };
    leadFinder?: Partial<LeadFinderConfig>;
  } = {};

  if (retention) {
    updates.retention = {};
    if (retention.syncHistory !== undefined) {
      if (!isValidRetentionPolicy(retention.syncHistory)) {
        return res.status(400).json({
          message:
            'syncHistory.enabled must be a boolean and syncHistory.retentionDays must be an integer between 1 and 3650',
        });
      }
      const safeSyncHistory: Partial<RetentionPolicy> = {};
      if (retention.syncHistory.enabled !== undefined) safeSyncHistory.enabled = retention.syncHistory.enabled;
      if (retention.syncHistory.retentionDays !== undefined) safeSyncHistory.retentionDays = retention.syncHistory.retentionDays;
      updates.retention.syncHistory = safeSyncHistory as RetentionPolicy;
    }

    if (retention.posts !== undefined) {
      if (!isValidRetentionPolicy(retention.posts)) {
        return res.status(400).json({
          message:
            'posts.enabled must be a boolean and posts.retentionDays must be an integer between 1 and 3650',
        });
      }
      const safePosts: Partial<RetentionPolicy> = {};
      if (retention.posts.enabled !== undefined) safePosts.enabled = retention.posts.enabled;
      if (retention.posts.retentionDays !== undefined) safePosts.retentionDays = retention.posts.retentionDays;
      updates.retention.posts = safePosts as RetentionPolicy;
    }
  }

  if (sync && sync.staleRun !== undefined) {
    if (typeof sync.staleRun !== 'object' || Array.isArray(sync.staleRun)) {
      return res.status(400).json({ message: 'sync.staleRun must be an object' });
    }
    const safeStaleRun: { enabled?: boolean; timeoutMinutes?: number } = {};

    if (sync.staleRun.enabled !== undefined) {
      if (typeof sync.staleRun.enabled !== 'boolean') {
        return res.status(400).json({ message: 'sync.staleRun.enabled must be a boolean' });
      }
      safeStaleRun.enabled = sync.staleRun.enabled;
    }

    if (sync.staleRun.timeoutMinutes !== undefined) {
      if (
        typeof sync.staleRun.timeoutMinutes !== 'number' ||
        !Number.isInteger(sync.staleRun.timeoutMinutes) ||
        sync.staleRun.timeoutMinutes < 5 ||
        sync.staleRun.timeoutMinutes > 1440
      ) {
        return res.status(400).json({
          message: 'sync.staleRun.timeoutMinutes must be an integer between 5 and 1440',
        });
      }
      safeStaleRun.timeoutMinutes = sync.staleRun.timeoutMinutes;
    }

    updates.sync = { staleRun: safeStaleRun };
  }

  if (ai) {
    updates.ai = {};

    const validateTaskConfig = (taskName: 'vision' | 'caption', config: any) => {
      if (typeof config !== 'object' || Array.isArray(config)) {
        return res.status(400).json({ message: `ai.${taskName} must be an object` });
      }

      const safeConfig: any = {};

      if (config.primaryProvider !== undefined) {
        if (config.primaryProvider !== 'groq' && config.primaryProvider !== 'gemini') {
          return res.status(400).json({ message: `ai.${taskName}.primaryProvider must be 'groq' or 'gemini'` });
        }
        safeConfig.primaryProvider = config.primaryProvider;
      }

      if (config.fallbackProvider !== undefined) {
        if (config.fallbackProvider !== 'groq' && config.fallbackProvider !== 'gemini') {
          return res.status(400).json({ message: `ai.${taskName}.fallbackProvider must be 'groq' or 'gemini'` });
        }
        safeConfig.fallbackProvider = config.fallbackProvider;
      }

      if (safeConfig.primaryProvider && safeConfig.fallbackProvider && safeConfig.primaryProvider === safeConfig.fallbackProvider) {
        return res.status(400).json({ message: `ai.${taskName} primaryProvider and fallbackProvider cannot be the same` });
      }

      if (config.providers !== undefined) {
        if (typeof config.providers !== 'object' || Array.isArray(config.providers)) {
          return res.status(400).json({ message: `ai.${taskName}.providers must be an object` });
        }

        safeConfig.providers = {};

        const validateProviderModels = (providerName: 'groq' | 'gemini') => {
          const p = config.providers[providerName];
          if (p !== undefined) {
            if (typeof p !== 'object' || Array.isArray(p)) {
              return res.status(400).json({ message: `ai.${taskName}.providers.${providerName} must be an object` });
            }
            if (p.models !== undefined) {
              if (!Array.isArray(p.models)) {
                return res.status(400).json({ message: `ai.${taskName}.providers.${providerName}.models must be an array` });
              }
              const models = p.models as any[];
              if (!models.every((m) => typeof m === 'string')) {
                return res.status(400).json({ message: `ai.${taskName}.providers.${providerName}.models must contain only strings` });
              }

              const trimmed = models.map((m) => (m as string).trim()).filter(Boolean);

              if (trimmed.length !== models.length) {
                return res.status(400).json({ message: `ai.${taskName}.providers.${providerName}.models cannot contain empty strings or whitespace-only strings` });
              }

              if (new Set(trimmed).size !== trimmed.length) {
                return res.status(400).json({ message: `ai.${taskName}.providers.${providerName}.models cannot contain duplicate values` });
              }

              const currentPrimary = safeConfig.primaryProvider || config.primaryProvider;
              if (currentPrimary === providerName && trimmed.length === 0) {
                return res.status(400).json({ message: `The primaryProvider (${providerName}) must have at least one valid model.` });
              }

              safeConfig.providers[providerName] = { models: trimmed };
            }
          }
          return null;
        };

        const groqError = validateProviderModels('groq');
        if (groqError) return groqError;

        const geminiError = validateProviderModels('gemini');
        if (geminiError) return geminiError;
      }

      return safeConfig;
    };

    if (ai.vision !== undefined) {
      const visionConfig = validateTaskConfig('vision', ai.vision);
      if (visionConfig.statusCode) return visionConfig;
      updates.ai.vision = visionConfig;
    }

    if (ai.caption !== undefined) {
      const captionConfig = validateTaskConfig('caption', ai.caption);
      if (captionConfig.statusCode) return captionConfig;
      updates.ai.caption = captionConfig;
    }
  }

  if (driveAutomation) {
    const safeDriveAutomation: Partial<DriveAutomationConfig> = {};

    if (driveAutomation.enabled !== undefined) {
      if (typeof driveAutomation.enabled !== 'boolean') {
        return res.status(400).json({ message: 'driveAutomation.enabled must be a boolean' });
      }
      safeDriveAutomation.enabled = driveAutomation.enabled;
    }

    if (driveAutomation.prepareDaysAhead !== undefined) {
      if (
        typeof driveAutomation.prepareDaysAhead !== 'number' ||
        !Number.isInteger(driveAutomation.prepareDaysAhead) ||
        driveAutomation.prepareDaysAhead < 1 ||
        driveAutomation.prepareDaysAhead > 90
      ) {
        return res.status(400).json({ message: 'driveAutomation.prepareDaysAhead must be an integer between 1 and 90' });
      }
      safeDriveAutomation.prepareDaysAhead = driveAutomation.prepareDaysAhead;
    }

    if (driveAutomation.cleanupEnabled !== undefined) {
      if (typeof driveAutomation.cleanupEnabled !== 'boolean') {
        return res.status(400).json({ message: 'driveAutomation.cleanupEnabled must be a boolean' });
      }
      safeDriveAutomation.cleanupEnabled = driveAutomation.cleanupEnabled;
    }

    if (driveAutomation.deleteFoldersOlderThanDays !== undefined) {
      if (
        typeof driveAutomation.deleteFoldersOlderThanDays !== 'number' ||
        !Number.isInteger(driveAutomation.deleteFoldersOlderThanDays) ||
        driveAutomation.deleteFoldersOlderThanDays < 1 ||
        driveAutomation.deleteFoldersOlderThanDays > 90
      ) {
        return res.status(400).json({
          message: 'driveAutomation.deleteFoldersOlderThanDays must be an integer between 1 and 90',
        });
      }
      safeDriveAutomation.deleteFoldersOlderThanDays = driveAutomation.deleteFoldersOlderThanDays;
    }

    if (driveAutomation.cleanupTime !== undefined) {
      if (typeof driveAutomation.cleanupTime !== 'string' || !isValidTimeFormat(driveAutomation.cleanupTime)) {
        return res.status(400).json({ message: 'driveAutomation.cleanupTime must be a valid time in HH:mm 24-hour format' });
      }
      safeDriveAutomation.cleanupTime = driveAutomation.cleanupTime;
    }

    updates.driveAutomation = safeDriveAutomation;
  }

  if (autoSync) {
    const safeAutoSync: { enabled?: boolean } = {};
    if (autoSync.enabled !== undefined) {
      if (typeof autoSync.enabled !== 'boolean') {
        return res.status(400).json({ message: 'autoSync.enabled must be a boolean' });
      }
      safeAutoSync.enabled = autoSync.enabled;
    }
    updates.autoSync = safeAutoSync;
  }

  if (leadFinder) {
    const safeLeadFinder: Partial<LeadFinderConfig> = {};

    if (leadFinder.leadFinderEnabled !== undefined) {
      if (typeof leadFinder.leadFinderEnabled !== 'boolean') {
        return res.status(400).json({ message: 'leadFinder.leadFinderEnabled must be a boolean' });
      }
      safeLeadFinder.leadFinderEnabled = leadFinder.leadFinderEnabled;
    }

    if (leadFinder.autoScrapingEnabled !== undefined) {
      if (typeof leadFinder.autoScrapingEnabled !== 'boolean') {
        return res.status(400).json({ message: 'leadFinder.autoScrapingEnabled must be a boolean' });
      }
      safeLeadFinder.autoScrapingEnabled = leadFinder.autoScrapingEnabled;
    }

    if (leadFinder.scrapingStartTime !== undefined) {
      if (typeof leadFinder.scrapingStartTime !== 'string' || !isValidTimeFormat(leadFinder.scrapingStartTime)) {
        return res.status(400).json({
          message: 'leadFinder.scrapingStartTime must be a valid time in HH:mm 24-hour format',
        });
      }
      safeLeadFinder.scrapingStartTime = leadFinder.scrapingStartTime.trim();
    }

    if (leadFinder.scrapingEndTime !== undefined) {
      if (typeof leadFinder.scrapingEndTime !== 'string' || !isValidTimeFormat(leadFinder.scrapingEndTime)) {
        return res.status(400).json({
          message: 'leadFinder.scrapingEndTime must be a valid time in HH:mm 24-hour format',
        });
      }
      safeLeadFinder.scrapingEndTime = leadFinder.scrapingEndTime.trim();
    }

    if (leadFinder.timezone !== undefined) {
      if (typeof leadFinder.timezone !== 'string' || !isValidIanaTimezone(leadFinder.timezone)) {
        return res.status(400).json({
          message: 'leadFinder.timezone must be a valid IANA timezone string (e.g. Asia/Dhaka, UTC, America/New_York)',
        });
      }
      safeLeadFinder.timezone = leadFinder.timezone.trim();
    }

    if (leadFinder.leadBufferPercent !== undefined) {
      if (
        typeof leadFinder.leadBufferPercent !== 'number' ||
        !Number.isInteger(leadFinder.leadBufferPercent) ||
        leadFinder.leadBufferPercent < 0 ||
        leadFinder.leadBufferPercent > 100
      ) {
        return res.status(400).json({
          message: 'leadFinder.leadBufferPercent must be an integer between 0 and 100',
        });
      }
      safeLeadFinder.leadBufferPercent = leadFinder.leadBufferPercent;
    }

    // Verify Start Time != End Time
    const currentSettings = await getPlatformSettings();
    const effectiveStartTime =
      safeLeadFinder.scrapingStartTime || currentSettings.leadFinder?.scrapingStartTime || '01:00';
    const effectiveEndTime =
      safeLeadFinder.scrapingEndTime || currentSettings.leadFinder?.scrapingEndTime || '05:00';

    if (effectiveStartTime === effectiveEndTime) {
      return res.status(400).json({
        message: 'Scraping start time and end time cannot be the same.',
      });
    }

    updates.leadFinder = safeLeadFinder;
  }

  const updatedSettings = await updatePlatformSettings(updates);
  return res.status(200).json(updatedSettings);
});

export const previewCleanup = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const target = req.params.target as string;
  if (!isValidTarget(target)) {
    return res.status(400).json({ message: 'Invalid cleanup target' });
  }

  const result = await runCleanup({ target, dryRun: true });
  return res.status(200).json(result);
});

export const executeCleanup = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const target = req.params.target as string;
  if (!isValidTarget(target)) {
    return res.status(400).json({ message: 'Invalid cleanup target' });
  }

  if (req.body.confirm !== true) {
    return res.status(400).json({ message: 'Explicit literal confirm: true is required to execute cleanup' });
  }

  const result = await runCleanup({ target, dryRun: false });
  return res.status(200).json(result);
});

export const previewStaleSyncs = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const result = await resolveStaleSyncRuns({ dryRun: true });
  return res.status(200).json(result);
});

export const resolveStaleSyncs = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  if (req.body.confirm !== true) {
    return res.status(400).json({ message: 'Explicit literal confirm: true is required to resolve stale syncs' });
  }

  const result = await resolveStaleSyncRuns({ dryRun: false });
  return res.status(200).json(result);
});
