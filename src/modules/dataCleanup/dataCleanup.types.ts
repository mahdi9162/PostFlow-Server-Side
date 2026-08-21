export type CleanupTarget = 'syncHistory' | 'posts';

export interface CleanupOptions {
  target: CleanupTarget;
  dryRun: boolean;
}

export interface CleanupSample {
  id: string;
  status: string;
  createdAt?: Date;
  completedAt?: Date; // For syncHistory
  postedAt?: Date; // For posts
}

export interface CleanupResult {
  target: CleanupTarget;
  dryRun: boolean;
  enabled: boolean;
  retentionDays?: number;
  cutoff?: Date;
  eligibleCount?: number;
  deletedCount?: number;
  message?: string;
  sample?: CleanupSample[];
}
