import { ObjectId } from 'mongodb';

export interface DriveMaintenanceResult {
  preparedDates: number;
  preparedAccountFolders: number;
  createdDateFolders: number;
  createdAccountFolders: number;
  cleanupCandidates: number;
  deletedFolders: number;
  cutoffDate: string | null;
  message: string;
}

export interface DriveAutomationRun {
  _id?: string | ObjectId;
  status: 'completed' | 'failed';
  triggeredBy: 'schedule' | 'manual';
  n8nExecutionId?: string;
  durationMs?: number;
  ranAt: Date;
  result?: DriveMaintenanceResult;
  errorMessage?: string;
  createdAt: Date;
}
