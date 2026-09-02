import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import * as seedService from './seedAccount.service';
import * as userService from '../user/user.service';
import { SeedAccountStatus } from './seedAccount.types';

const checkApprovedUser = async (uid: string) => {
  const user = await userService.findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved') {
    return null;
  }
  return user;
};

const checkAdminUser = async (uid: string) => {
  const user = await checkApprovedUser(uid);
  if (!user || user.role !== 'admin') {
    return null;
  }
  return user;
};

export const getSeedAccounts = catchAsync(async (req: Request, res: Response) => {
  const { uid } = req.user!;
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const user = await checkApprovedUser(uid);
  if (!user) return res.status(403).json({ message: 'Forbidden' });

  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const seeds = await seedService.getSeedAccounts({ status, search });
  return res.status(200).json({
    count: seeds.length,
    seeds,
  });
});

export const getSeedAccountById = catchAsync(async (req: Request, res: Response) => {
  const { uid } = req.user!;
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const user = await checkApprovedUser(uid);
  if (!user) return res.status(403).json({ message: 'Forbidden' });

  const id = req.params.id as string;
  const seed = await seedService.getSeedAccountById(id);

  if (!seed) {
    return res.status(404).json({ message: 'Seed account not found' });
  }

  return res.status(200).json(seed);
});

export const createSeedAccount = catchAsync(async (req: Request, res: Response) => {
  const { uid } = req.user!;
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const adminUser = await checkAdminUser(uid);
  if (!adminUser) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  const rawInput = req.body.input || req.body.username;
  if (!rawInput || typeof rawInput !== 'string') {
    return res.status(400).json({ message: 'Input is required (username or Instagram profile URL)' });
  }

  try {
    const created = await seedService.createManualSeedAccount(rawInput);
    return res.status(201).json(created);
  } catch (err: any) {
    if (err.name === 'ConflictError') {
      return res.status(409).json({ message: err.message, existing: err.existingRecord });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    throw err;
  }
});

export const updateSeedAccount = catchAsync(async (req: Request, res: Response) => {
  const { uid } = req.user!;
  if (!uid) return res.status(401).json({ message: 'Unauthorized' });

  const adminUser = await checkAdminUser(uid);
  if (!adminUser) {
    return res.status(403).json({ message: 'Forbidden: Admin only' });
  }

  const id = req.params.id as string;
  const { status, enabled } = req.body;

  const validStatuses: SeedAccountStatus[] = ['verified', 'paused', 'archived', 'candidate'];
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status: must be one of ${validStatuses.join(', ')}` });
  }

  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled must be a boolean' });
  }

  const updated = await seedService.updateSeedAccount(id, { status, enabled });
  if (!updated) {
    return res.status(404).json({ message: 'Seed account not found' });
  }

  return res.status(200).json(updated);
});
