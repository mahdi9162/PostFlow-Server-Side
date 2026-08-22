import { ObjectId } from 'mongodb';

export interface AccountSyncSummary {
  found: number;
  created: number;
  duplicates: number;
  qualitySkipped: number;
  failed: number;
}

export interface RetryItem {
  account: string;
  driveFileId: string;
  fileName?: string;
  mimeType?: string;
  fingerprint?: string;
}

export type FailedSyncItem = {
  account: string;
  driveFileId: string;
  fileName?: string;
  mimeType?: string;
  fingerprint?: string;

  stage:
    | 'duplicate-check'
    | 'vision'
    | 'caption'
    | 'create-post'
    | 'workflow';

  reason: string;
  message: string;

  attempts?: Array<{
    stage: 'vision' | 'caption';
    provider: 'groq' | 'gemini';
    model: string;
    success: boolean;
    statusCode?: number | null;
    reason: string;
    message?: string;
  }>;
};

export interface SyncRunResult {
  success: boolean;
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' | 'INCOMPLETE';
  targetDate: string;
  totalCandidates?: number;
  processed?: number;
  created?: number;
  skippedDuplicates?: number;
  qualitySkipped?: number;
  failed?: number;
  accounts?: Record<string, AccountSyncSummary>;
  message?: string;
  resolutionReason?: 'STALE_TIMEOUT';
  failedItems?: FailedSyncItem[];
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
  retryOf?: string;
}
