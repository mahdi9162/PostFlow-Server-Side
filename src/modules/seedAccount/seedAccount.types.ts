import { ObjectId } from 'mongodb';

export type SeedAccountStatus = 'verified' | 'paused' | 'archived' | 'candidate';
export type SeedAccountSource = 'manual' | 'auto-discovery';

export interface SeedAccount {
  _id?: ObjectId;
  username: string; // Canonical normalized lowercase username
  profileUrl: string; // https://www.instagram.com/{username}/
  status: SeedAccountStatus;
  source: SeedAccountSource;
  enabled: boolean;

  // Optional metadata fields (populated in future phases / scraping)
  followersCount?: number;
  biography?: string;
  profilePicUrl?: string;
  usConfidence?: number;
  pugRelevance?: number;

  // C2 future discovery tracking (optional / null in C1)
  discoveredFrom?: string;
  discoveryReason?: string;

  verifiedAt?: Date;
  lastScannedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManualSeedInput {
  input: string; // Raw input: @username or profile URL
}

export interface UpdateSeedStatusInput {
  status?: SeedAccountStatus;
  enabled?: boolean;
}
