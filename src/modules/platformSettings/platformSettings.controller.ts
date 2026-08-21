import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
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

  const { retention } = req.body;
  if (!retention || typeof retention !== 'object' || Array.isArray(retention)) {
    return res.status(400).json({ message: 'Invalid payload: retention object is required' });
  }

  const updates: { syncHistory?: RetentionPolicy; posts?: RetentionPolicy } = {};

  if (retention.syncHistory !== undefined) {
    if (!isValidRetentionPolicy(retention.syncHistory)) {
      return res.status(400).json({ message: 'syncHistory.enabled must be a boolean and syncHistory.retentionDays must be an integer between 1 and 3650' });
    }
    const safeSyncHistory: Partial<RetentionPolicy> = {};
    if (retention.syncHistory.enabled !== undefined) safeSyncHistory.enabled = retention.syncHistory.enabled;
    if (retention.syncHistory.retentionDays !== undefined) safeSyncHistory.retentionDays = retention.syncHistory.retentionDays;
    updates.syncHistory = safeSyncHistory as RetentionPolicy;
  }

  if (retention.posts !== undefined) {
    if (!isValidRetentionPolicy(retention.posts)) {
      return res.status(400).json({ message: 'posts.enabled must be a boolean and posts.retentionDays must be an integer between 1 and 3650' });
    }
    const safePosts: Partial<RetentionPolicy> = {};
    if (retention.posts.enabled !== undefined) safePosts.enabled = retention.posts.enabled;
    if (retention.posts.retentionDays !== undefined) safePosts.retentionDays = retention.posts.retentionDays;
    updates.posts = safePosts as RetentionPolicy;
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
