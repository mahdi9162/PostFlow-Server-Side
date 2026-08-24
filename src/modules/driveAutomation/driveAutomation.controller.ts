import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { saveRun, getLatestRun } from './driveAutomation.service';
import { DriveAutomationRun, DriveMaintenanceResult } from './driveAutomation.types';
import { findUserByFirebaseUid } from '../user/user.service';

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

export const fetchLatestRun = catchAsync(async (req: Request, res: Response) => {
  if (!(await requireAdminAccess(req, res))) return;

  const latestRun = await getLatestRun();
  if (!latestRun) {
    return res.status(404).json({ message: 'No drive automation runs found.' });
  }

  return res.status(200).json(latestRun);
});

export const recordRun = catchAsync(async (req: Request, res: Response) => {
  const { status, triggeredBy, n8nExecutionId, durationMs, ranAt, result, errorMessage } = req.body;

  if (status !== 'completed' && status !== 'failed') {
    return res.status(400).json({ message: 'status must be completed or failed' });
  }

  if (triggeredBy !== 'schedule' && triggeredBy !== 'manual') {
    return res.status(400).json({ message: 'triggeredBy must be schedule or manual' });
  }

  if (n8nExecutionId !== undefined && typeof n8nExecutionId !== 'string') {
    return res.status(400).json({ message: 'n8nExecutionId must be a string if provided' });
  }

  if (durationMs !== undefined && (typeof durationMs !== 'number' || durationMs < 0 || !Number.isInteger(durationMs))) {
    return res.status(400).json({ message: 'durationMs must be a non-negative integer if provided' });
  }

  if (!ranAt || isNaN(new Date(ranAt).getTime())) {
    return res.status(400).json({ message: 'ranAt must be a valid date string' });
  }

  if (status === 'completed' && (!result || typeof result !== 'object')) {
    return res.status(400).json({ message: 'result is required for completed runs' });
  }

  if (status === 'failed' && errorMessage !== undefined && typeof errorMessage !== 'string') {
    return res.status(400).json({ message: 'errorMessage must be a string if provided' });
  }

  let validatedResult: DriveMaintenanceResult | undefined;

  if (result) {
    const {
      preparedDates,
      preparedAccountFolders,
      createdDateFolders,
      createdAccountFolders,
      cleanupCandidates,
      deletedFolders,
      cutoffDate,
      message
    } = result;

    const isNonNegativeInteger = (val: any) => typeof val === 'number' && Number.isInteger(val) && val >= 0;

    if (!isNonNegativeInteger(preparedDates) ||
        !isNonNegativeInteger(preparedAccountFolders) ||
        !isNonNegativeInteger(createdDateFolders) ||
        !isNonNegativeInteger(createdAccountFolders) ||
        !isNonNegativeInteger(cleanupCandidates) ||
        !isNonNegativeInteger(deletedFolders)) {
      return res.status(400).json({ message: 'numeric values in result must be non-negative integers' });
    }

    if (cutoffDate !== null && typeof cutoffDate !== 'string') {
      return res.status(400).json({ message: 'cutoffDate must be string or null' });
    }

    if (typeof message !== 'string') {
      return res.status(400).json({ message: 'message must be a string' });
    }

    validatedResult = {
      preparedDates,
      preparedAccountFolders,
      createdDateFolders,
      createdAccountFolders,
      cleanupCandidates,
      deletedFolders,
      cutoffDate,
      message
    };
  }

  const runData: DriveAutomationRun = {
    status,
    triggeredBy,
    ranAt: new Date(ranAt),
    createdAt: new Date(),
  };

  if (n8nExecutionId) runData.n8nExecutionId = n8nExecutionId;
  if (durationMs !== undefined) runData.durationMs = durationMs;
  if (validatedResult) runData.result = validatedResult;
  if (errorMessage !== undefined) runData.errorMessage = errorMessage;

  const saved = await saveRun(runData);

  return res.status(201).json(saved);
});
