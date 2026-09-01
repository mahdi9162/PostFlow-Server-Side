import { ObjectId } from 'mongodb';

export interface AccountSyncSummary {
  found: number;
  created: number;
  duplicates: number;
  qualitySkipped: number;
  failed: number;

  target?: number | null;
  preparedBefore?: number;
  remainingNeeded?: number | null;
  driveFound?: number;
  knownPreparedStillInDrive?: number;
  newAvailable?: number;
  selected?: number;
  extra?: number;
  shortage?: number;
  warning?: 'EXTRA_MEDIA' | 'NOT_ENOUGH_MEDIA' | null;
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
  lockKey?: 'global-sync';
  triggeredBy: string;
  result?: SyncRunResult;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  retryOf?: string;
}
