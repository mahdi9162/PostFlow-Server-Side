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
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'INCOMPLETE';
  targetDate: string;
  totalCandidates: number;
  processed: number;
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
  status: 'running' | 'completed' | 'partial_success' | 'failed' | 'incomplete';
  triggeredBy: string;
  result?: SyncRunResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}
