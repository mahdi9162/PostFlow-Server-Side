import { ReleaseBatchInfo } from './lead.types';

/**
 * Exact deterministic generation target formula (B3/B4):
 * generationTarget = ceil(dailyLeadTarget * (1 + leadBufferPercent / 100))
 * If dailyLeadTarget <= 0, generationTarget is 0.
 */
export const calculateGenerationTarget = (
  dailyLeadTarget: number,
  leadBufferPercent: number = 0
): number => {
  if (typeof dailyLeadTarget !== 'number' || isNaN(dailyLeadTarget) || dailyLeadTarget <= 0) {
    return 0;
  }
  const safeBuffer = Math.max(0, Math.min(100, Math.floor(Number(leadBufferPercent) || 0)));
  return Math.ceil(dailyLeadTarget * (1 + safeBuffer / 100));
};

/**
 * Release Batch Calculation (B3):
 * Partitions dailyLeadTarget into batches of up to releaseBatchSize, spaced by releaseIntervalMinutes.
 * anchorTime is the start time of Batch 1 (offset 0).
 */
export const calculateReleaseBatches = (
  dailyLeadTarget: number,
  releaseBatchSize: number,
  releaseIntervalMinutes: number,
  anchorTime: Date = new Date()
): ReleaseBatchInfo[] => {
  if (
    typeof dailyLeadTarget !== 'number' ||
    isNaN(dailyLeadTarget) ||
    dailyLeadTarget <= 0 ||
    typeof releaseBatchSize !== 'number' ||
    isNaN(releaseBatchSize) ||
    releaseBatchSize <= 0
  ) {
    return [];
  }

  const safeInterval = Math.max(1, Math.floor(releaseIntervalMinutes || 180));
  const numBatches = Math.ceil(dailyLeadTarget / releaseBatchSize);
  const batches: ReleaseBatchInfo[] = [];

  for (let i = 0; i < numBatches; i++) {
    const batchIndex = i + 1;
    const offsetMinutes = i * safeInterval;
    const availableAt = new Date(anchorTime.getTime() + offsetMinutes * 60 * 1000);
    const size = Math.min(releaseBatchSize, dailyLeadTarget - i * releaseBatchSize);

    batches.push({
      batchIndex,
      size,
      availableAt,
      offsetMinutes,
    });
  }

  return batches;
};

/**
 * Compute the slot for the N-th assigned lead (0-based existingNormalCount).
 * If existingNormalCount < dailyLeadTarget, lead is placed into its calculated release batch.
 * If existingNormalCount >= dailyLeadTarget, lead is marked as reserve.
 */
export const computeLeadSlot = (
  existingNormalCount: number,
  dailyLeadTarget: number,
  releaseBatchSize: number,
  releaseIntervalMinutes: number,
  anchorTime: Date = new Date()
): { isReserve: boolean; batchIndex?: number; availableAt?: Date } => {
  if (existingNormalCount < dailyLeadTarget) {
    const safeBatchSize = Math.max(1, releaseBatchSize);
    const safeInterval = Math.max(1, releaseIntervalMinutes);
    const batchIndex = Math.floor(existingNormalCount / safeBatchSize) + 1;
    const offsetMinutes = (batchIndex - 1) * safeInterval;
    const availableAt = new Date(anchorTime.getTime() + offsetMinutes * 60 * 1000);
    return {
      isReserve: false,
      batchIndex,
      availableAt,
    };
  }

  return {
    isReserve: true,
  };
};

/**
 * Pure counting helper for quota needs given targets and current DB assignments.
 */
export const calculateQuotaNeeds = (params: {
  dailyLeadTarget: number;
  leadBufferPercent: number;
  assignedNormalCount: number;
  reserveCount: number;
}): {
  visibleTarget: number;
  generationTarget: number;
  assignedNormalCount: number;
  reserveCount: number;
  totalAssignedCount: number;
  remainingNormalNeed: number;
  remainingGenerationNeed: number;
} => {
  const visibleTarget = Math.max(0, Math.floor(params.dailyLeadTarget || 0));
  const generationTarget = calculateGenerationTarget(visibleTarget, params.leadBufferPercent);
  const assignedNormalCount = Math.max(0, Math.floor(params.assignedNormalCount || 0));
  const reserveCount = Math.max(0, Math.floor(params.reserveCount || 0));
  const totalAssignedCount = assignedNormalCount + reserveCount;

  const remainingNormalNeed = Math.max(0, visibleTarget - assignedNormalCount);
  const remainingGenerationNeed = Math.max(0, generationTarget - totalAssignedCount);

  return {
    visibleTarget,
    generationTarget,
    assignedNormalCount,
    reserveCount,
    totalAssignedCount,
    remainingNormalNeed,
    remainingGenerationNeed,
  };
};
