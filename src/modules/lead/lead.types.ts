import { ObjectId } from 'mongodb';

export type LeadAssignmentStatus = 'pending' | 'followed' | 'skipped' | 'rejected';
export type LeadSource = 'auto' | 'manual';

export interface LeadAssignment {
  _id?: ObjectId;
  candidateId: string;
  candidateUsername?: string;
  targetAccountId: ObjectId;
  accountSlug?: string;
  assignedDate: string; // YYYY-MM-DD
  status: LeadAssignmentStatus;
  isReserve: boolean;
  batchIndex?: number;
  availableAt?: Date; // UTC Date timestamp
  source: LeadSource;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseBatchInfo {
  batchIndex: number;
  size: number;
  availableAt: Date;
  offsetMinutes: number;
}

export interface LeadQuotaSummary {
  targetAccountId: string;
  accountSlug: string;
  assignedDate: string;
  visibleTarget: number;
  bufferPercent: number;
  generationTarget: number;
  assignedNormalCount: number;
  reserveCount: number;
  totalAssignedCount: number;
  remainingNormalNeed: number;
  remainingGenerationNeed: number;
  releaseBatches: ReleaseBatchInfo[];
}

export interface AssignCandidateInput {
  candidateId: string;
  candidateUsername?: string;
  source?: LeadSource;
  metadata?: Record<string, any>;
}
