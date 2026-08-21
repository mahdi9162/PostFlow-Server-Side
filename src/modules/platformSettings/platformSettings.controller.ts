import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { resolveStaleSyncRuns } from '../sync/staleSync.service';
import { findUserByFirebaseUid } from '../user/user.service';
import { getPlatformSettings, updatePlatformSettings } from './platformSettings.service';
import { RetentionPolicy } from './platformSettings.types';
import { runCleanup } from '../dataCleanup/dataCleanup.service';
import { CleanupTarget } from '../dataCleanup/dataCleanup.types';

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

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const { retention, sync } = req.body;
  if (retention !== undefined && (typeof retention !== 'object' || Array.isArray(retention))) {
    return res.status(400).json({ message: 'Invalid payload: retention must be an object' });
  }
  if (sync !== undefined && (typeof sync !== 'object' || Array.isArray(sync))) {
    return res.status(400).json({ message: 'Invalid payload: sync must be an object' });
  }

  const updates: { 
    retention?: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy };
    sync?: { staleRun?: { enabled?: boolean; timeoutMinutes?: number } };
  } = {};

  if (retention) {
    updates.retention = {};
    if (retention.syncHistory !== undefined) {
    if (!isValidRetentionPolicy(retention.syncHistory)) {
      return res.status(400).json({ message: 'syncHistory.enabled must be a boolean and syncHistory.retentionDays must be an integer between 1 and 3650' });
    }
    const safeSyncHistory: Partial<RetentionPolicy> = {};
    if (retention.syncHistory.enabled !== undefined) safeSyncHistory.enabled = retention.syncHistory.enabled;
    if (retention.syncHistory.retentionDays !== undefined) safeSyncHistory.retentionDays = retention.syncHistory.retentionDays;
    updates.retention.syncHistory = safeSyncHistory as RetentionPolicy;
  }

  if (retention.posts !== undefined) {
    if (!isValidRetentionPolicy(retention.posts)) {
      return res.status(400).json({ message: 'posts.enabled must be a boolean and posts.retentionDays must be an integer between 1 and 3650' });
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
      if (typeof sync.staleRun.timeoutMinutes !== 'number' || !Number.isInteger(sync.staleRun.timeoutMinutes) || sync.staleRun.timeoutMinutes < 5 || sync.staleRun.timeoutMinutes > 1440) {
        return res.status(400).json({ message: 'sync.staleRun.timeoutMinutes must be an integer between 5 and 1440' });
      }
      safeStaleRun.timeoutMinutes = sync.staleRun.timeoutMinutes;
    }

    updates.sync = { staleRun: safeStaleRun };
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
