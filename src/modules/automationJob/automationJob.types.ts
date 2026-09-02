import { ObjectId } from 'mongodb';

export type HeavyJobType = 'POST_SYNC' | 'LEAD_AUTO' | 'LEAD_MANUAL';

export type HeavyJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'incomplete'
  | 'cancelled';

export const HEAVY_JOB_PRIORITY = {
  POST_SYNC_MANUAL: 50,
  POST_SYNC_RETRY: 40,
  POST_SYNC_AUTO: 30,
  LEAD_MANUAL: 20,
  LEAD_AUTO: 10,
} as const;

export type HeavyJobPriority = (typeof HEAVY_JOB_PRIORITY)[keyof typeof HEAVY_JOB_PRIORITY] | number;

export interface AutomationJob {
  _id?: ObjectId;
  jobType: HeavyJobType;
  status: HeavyJobStatus;
  lockKey?: 'global-heavy-lock';
  priority: number;
  targetDate?: string;
  triggeredBy: string;
  referenceId?: ObjectId;
  payload?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface EnqueueJobParams {
  jobType: HeavyJobType;
  priority: number;
  targetDate?: string;
  triggeredBy: string;
  payload?: Record<string, any>;
  referenceId?: ObjectId;
}

export interface EnqueueJobResult {
  job: AutomationJob;
  isCoalesced: boolean;
}
