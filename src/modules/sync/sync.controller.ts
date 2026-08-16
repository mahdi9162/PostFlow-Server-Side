import { Request, Response } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import catchAsync from '../../utils/catchAsync';
import { findUserByFirebaseUid } from '../user/user.service';
import { validateAndDeriveDay } from '../post/post.helper';
import { triggerSync, createSyncRun, getSyncRunById, updateSyncRunToFailed, updateSyncRunToCompleted } from './sync.service';

const isNonNegativeFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const prepareSync = catchAsync(async (req: Request, res: Response) => {
  const { targetDate } = req.body;

  if (!targetDate || typeof targetDate !== 'string') {
    return res.status(400).json({ message: 'targetDate is required and must be a string' });
  }

  const day = validateAndDeriveDay(targetDate);
  if (!day) {
    return res.status(400).json({ message: 'Invalid targetDate format or impossible date' });
  }

  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || (user.role !== 'admin' && user.role !== 'creator')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const triggeredBy = user.email || uid;
  const syncId = await createSyncRun(targetDate, triggeredBy);

  const payload = {
    targetDate,
    triggeredBy,
    requestId: crypto.randomUUID(),
    syncId: syncId.toString(),
  };

  try {
    await triggerSync(payload);
  } catch (error: any) {
    await updateSyncRunToFailed(syncId.toString(), 'Sync workflow could not be started.');
    return res.status(502).json({ message: 'Sync workflow could not be started.' });
  }

  return res.status(200).json({
    success: true,
    syncId: syncId.toString(),
    targetDate,
    status: 'running',
    message: 'Sync started'
  });
});

export const getSyncStatus = catchAsync(async (req: Request, res: Response) => {
  const syncId = req.params.syncId as string;

  if (!ObjectId.isValid(syncId)) {
    return res.status(400).json({ message: 'Invalid syncId' });
  }

  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || (user.role !== 'admin' && user.role !== 'creator')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const syncRun = await getSyncRunById(syncId);
  if (!syncRun) {
    return res.status(404).json({ message: 'Sync run not found' });
  }

  if (syncRun.status === 'running') {
    return res.status(200).json({
      success: true,
      syncId: syncRun._id?.toString(),
      targetDate: syncRun.targetDate,
      status: 'running',
      createdAt: syncRun.createdAt
    });
  }

  if (syncRun.status === 'completed') {
    return res.status(200).json({
      success: true,
      syncId: syncRun._id?.toString(),
      targetDate: syncRun.targetDate,
      status: 'completed',
      result: syncRun.result,
      completedAt: syncRun.completedAt
    });
  }

  if (syncRun.status === 'failed') {
    return res.status(200).json({
      success: false,
      syncId: syncRun._id?.toString(),
      targetDate: syncRun.targetDate,
      status: 'failed',
      message: syncRun.errorMessage || 'Sync failed.'
    });
  }
});

export const internalCompleteSync = catchAsync(async (req: Request, res: Response) => {
  const syncId = req.params.syncId as string;
  const data = req.body;

  if (!ObjectId.isValid(syncId)) {
    return res.status(400).json({ message: 'Invalid syncId' });
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ message: 'Invalid summary payload format' });
  }

  const syncRun = await getSyncRunById(syncId);
  if (!syncRun) {
    return res.status(404).json({ message: 'Sync run not found' });
  }

  // Early guard
  if (syncRun.status !== 'running') {
    return res.status(200).json({ message: 'Sync run is already finalized' });
  }

  if (data.targetDate !== syncRun.targetDate) {
    return res.status(400).json({ message: 'targetDate mismatch' });
  }

  if (
    data.success !== true ||
    typeof data.targetDate !== 'string' ||
    !isNonNegativeFiniteNumber(data.totalCandidates) ||
    !isNonNegativeFiniteNumber(data.created) ||
    !isNonNegativeFiniteNumber(data.skippedDuplicates) ||
    !isNonNegativeFiniteNumber(data.qualitySkipped) ||
    !isNonNegativeFiniteNumber(data.failed) ||
    typeof data.accounts !== 'object' || data.accounts === null || Array.isArray(data.accounts)
  ) {
    return res.status(400).json({ message: 'Invalid summary payload format' });
  }

  for (const acc in data.accounts) {
    const accData = data.accounts[acc];
    if (typeof accData !== 'object' || accData === null || Array.isArray(accData)) {
      return res.status(400).json({ message: `Invalid summary payload format for account ${acc}` });
    }
    if (
      !isNonNegativeFiniteNumber(accData.found) ||
      !isNonNegativeFiniteNumber(accData.created) ||
      !isNonNegativeFiniteNumber(accData.duplicates) ||
      !isNonNegativeFiniteNumber(accData.qualitySkipped) ||
      !isNonNegativeFiniteNumber(accData.failed)
    ) {
      return res.status(400).json({ message: `Invalid summary payload format for account ${acc}` });
    }
  }

  const resultPayload = {
    success: data.success,
    targetDate: data.targetDate,
    totalCandidates: data.totalCandidates,
    created: data.created,
    skippedDuplicates: data.skippedDuplicates,
    qualitySkipped: data.qualitySkipped,
    failed: data.failed,
    accounts: data.accounts,
    message: typeof data.message === 'string' ? data.message : undefined
  };

  const updated = await updateSyncRunToCompleted(syncId, resultPayload);
  if (!updated) {
    return res.status(200).json({ message: 'Sync run is already finalized' });
  }

  return res.status(200).json({ message: 'Sync completed' });
});

export const internalFailSync = catchAsync(async (req: Request, res: Response) => {
  const syncId = req.params.syncId as string;

  if (!ObjectId.isValid(syncId)) {
    return res.status(400).json({ message: 'Invalid syncId' });
  }

  const syncRun = await getSyncRunById(syncId);
  if (!syncRun) {
    return res.status(404).json({ message: 'Sync run not found' });
  }

  // Early guard
  if (syncRun.status !== 'running') {
    return res.status(200).json({ message: 'Sync run is already finalized' });
  }

  const updated = await updateSyncRunToFailed(syncId, 'Sync workflow failed.');
  if (!updated) {
    return res.status(200).json({ message: 'Sync run is already finalized' });
  }

  return res.status(200).json({ message: 'Sync marked as failed' });
});
