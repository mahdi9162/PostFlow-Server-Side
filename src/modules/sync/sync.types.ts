import { ObjectId } from 'mongodb';

export interface AccountSyncSummary {
  found: number;
  created: number;
  duplicates: number;
  qualitySkipped: number;
  failed: number;
}

export interface SyncRunResult {
  success: boolean;
  targetDate: string;
  totalCandidates: number;
  created: number;
  skippedDuplicates: number;
  qualitySkipped: number;
  failed: number;
  accounts: Record<string, AccountSyncSummary>;
  message?: string;
}

export interface SyncRun {
  _id?: ObjectId;
  targetDate: string;
  status: 'running' | 'completed' | 'failed';
  triggeredBy: string;
  result?: SyncRunResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
