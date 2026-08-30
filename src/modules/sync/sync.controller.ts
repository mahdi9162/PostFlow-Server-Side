import { Request, Response } from 'express';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import catchAsync from '../../utils/catchAsync';
import { findUserByFirebaseUid } from '../user/user.service';
import { validateAndDeriveDay } from '../post/post.helper';
import { triggerSync, createSyncRun, getSyncRunById, getChildRetrySyncRun, updateSyncRunToFailed, updateSyncRunToFinalized, getPaginatedSyncHistory } from './sync.service';
import { getPlatformSettings } from '../platformSettings/platformSettings.service';

const isNonNegativeFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const handleSyncTrigger = async (targetDate: string, triggeredBy: string, res: Response) => {
  const syncId = await createSyncRun(targetDate, triggeredBy);
  const settings = await getPlatformSettings();

  const payload = {
    targetDate,
    triggeredBy,
    requestId: crypto.randomUUID(),
    syncId: syncId.toString(),
    aiConfig: settings.ai,
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
};

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
  
  return handleSyncTrigger(targetDate, triggeredBy, res);
});

export const retryFailedSync = catchAsync(async (req: Request, res: Response) => {
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

  const originalSyncRun = await getSyncRunById(syncId);
  if (!originalSyncRun) {
    return res.status(404).json({ message: 'Sync run not found' });
  }

  if (!originalSyncRun.result?.failedItems || originalSyncRun.result.failedItems.length === 0) {
    return res.status(400).json({ message: 'This sync run has no failed items to retry.' });
  }

  const existingRetry = await getChildRetrySyncRun(syncId);
  if (existingRetry) {
    return res.status(409).json({
      message: 'This sync run has already been retried.',
      retryRunId: existingRetry._id?.toString()
    });
  }

  const triggeredBy = user.email || uid;
  const newSyncId = await createSyncRun(originalSyncRun.targetDate, triggeredBy, syncId);
  const settings = await getPlatformSettings();

  const retryItems = originalSyncRun.result.failedItems.map((item) => ({
    account: item.account,
    driveFileId: item.driveFileId,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fingerprint: item.fingerprint
  }));

  const payload = {
    targetDate: originalSyncRun.targetDate,
    triggeredBy,
    requestId: crypto.randomUUID(),
    syncId: newSyncId.toString(),
    aiConfig: settings.ai,
    retryItems,
  };

  try {
    await triggerSync(payload);
  } catch (error: any) {
    await updateSyncRunToFailed(newSyncId.toString(), 'Sync workflow could not be started.');
    return res.status(502).json({ message: 'Sync workflow could not be started.' });
  }

  return res.status(200).json({
    success: true,
    syncId: newSyncId.toString(),
    targetDate: originalSyncRun.targetDate,
    status: 'running',
    message: 'Retry sync started'
  });
});

export const getSyncHistory = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = await findUserByFirebaseUid(uid);
  if (!user || user.status !== 'approved' || (user.role !== 'admin' && user.role !== 'creator')) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const { runs, totalCount } = await getPaginatedSyncHistory(page, limit);

  return res.status(200).json({
    runs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
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
      createdAt: syncRun.createdAt,
      retryOf: syncRun.retryOf,
      retryRunId: (await getChildRetrySyncRun(syncRun._id!.toString()))?._id?.toString()
    });
  }

  if (syncRun.status === 'completed' || syncRun.status === 'partial_success' || syncRun.status === 'incomplete' || (syncRun.status === 'failed' && syncRun.result)) {
    return res.status(200).json({
      success: syncRun.result ? syncRun.result.success : false,
      syncId: syncRun._id?.toString(),
      targetDate: syncRun.targetDate,
      status: syncRun.status,
      result: syncRun.result,
      completedAt: syncRun.completedAt,
      retryOf: syncRun.retryOf,
      retryRunId: (await getChildRetrySyncRun(syncRun._id!.toString()))?._id?.toString()
    });
  }

  if (syncRun.status === 'failed') {
    return res.status(200).json({
      success: false,
      syncId: syncRun._id?.toString(),
      targetDate: syncRun.targetDate,
      status: 'failed',
      message: syncRun.errorMessage || 'Sync failed.',
      retryOf: syncRun.retryOf,
      retryRunId: (await getChildRetrySyncRun(syncRun._id!.toString()))?._id?.toString()
    });
  }
});

export const internalFinalizeSync = catchAsync(async (req: Request, res: Response) => {
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

  const allowedStatuses = ['COMPLETED', 'PARTIAL_SUCCESS', 'FAILED', 'INCOMPLETE'];
  if (!allowedStatuses.includes(data.status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  if (
    typeof data.success !== 'boolean' ||
    typeof data.targetDate !== 'string' ||
    !isNonNegativeFiniteNumber(data.totalCandidates) ||
    !isNonNegativeFiniteNumber(data.processed) ||
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

  const derivedProcessed = data.created + data.skippedDuplicates + data.qualitySkipped + data.failed;
  if (data.processed !== derivedProcessed) {
    return res.status(400).json({ message: 'processed must equal created + skippedDuplicates + qualitySkipped + failed' });
  }

  if (data.processed > data.totalCandidates) {
    return res.status(400).json({ message: 'processed cannot exceed totalCandidates' });
  }

  if (data.status === 'COMPLETED') {
    if (data.processed !== data.totalCandidates || data.failed !== 0 || data.success !== true) {
      return res.status(400).json({ message: 'Invalid status condition: COMPLETED requires processed === totalCandidates, failed === 0, success === true' });
    }
  } else if (data.status === 'PARTIAL_SUCCESS') {
    if (data.processed !== data.totalCandidates || data.failed === 0 || data.created === 0 || data.success !== false) {
      return res.status(400).json({ message: 'Invalid status condition: PARTIAL_SUCCESS requires processed === totalCandidates, failed > 0, created > 0, success === false' });
    }
  } else if (data.status === 'FAILED') {
    if (data.processed !== data.totalCandidates || data.failed === 0 || data.created !== 0 || data.success !== false) {
      return res.status(400).json({ message: 'Invalid status condition: FAILED requires processed === totalCandidates, failed > 0, created === 0, success === false' });
    }
  } else if (data.status === 'INCOMPLETE') {
    if (data.processed >= data.totalCandidates || data.success !== false) {
      return res.status(400).json({ message: 'Invalid status condition: INCOMPLETE requires processed < totalCandidates, success === false' });
    }
  }

  const resultPayload = {
    success: data.success,
    status: data.status as 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'INCOMPLETE',
    targetDate: data.targetDate,
    totalCandidates: data.totalCandidates,
    processed: data.processed,
    created: data.created,
    skippedDuplicates: data.skippedDuplicates,
    qualitySkipped: data.qualitySkipped,
    failed: data.failed,
    accounts: data.accounts,
    message: typeof data.message === 'string' ? data.message : undefined,
    failedItems: Array.isArray(data.failedItems) ? data.failedItems : []
  };

  const internalStatusMap: Record<string, 'completed' | 'partial_success' | 'failed' | 'incomplete'> = {
    'COMPLETED': 'completed',
    'PARTIAL_SUCCESS': 'partial_success',
    'FAILED': 'failed',
    'INCOMPLETE': 'incomplete'
  };

  const dbStatus = internalStatusMap[data.status];

  const updated = await updateSyncRunToFinalized(syncId, dbStatus, resultPayload);
  if (!updated) {
    return res.status(200).json({ message: 'Sync run is already finalized' });
  }

  return res.status(200).json({ message: 'Sync finalized successfully' });
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

export const internalPrepareSync = catchAsync(async (req: Request, res: Response) => {
  const { targetDate } = req.body;

  if (!targetDate || typeof targetDate !== 'string') {
    return res.status(400).json({ message: 'targetDate is required and must be a string' });
  }

  const day = validateAndDeriveDay(targetDate);
  if (!day) {
    return res.status(400).json({ message: 'Invalid targetDate format or impossible date' });
  }

  return handleSyncTrigger(targetDate, 'system-auto-sync', res);
});
