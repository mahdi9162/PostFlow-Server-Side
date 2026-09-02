import { ObjectId } from 'mongodb';

export type SeedAccountStatus = 'verified' | 'paused' | 'archived' | 'candidate';
export type SeedAccountSource = 'manual' | 'auto-discovery';

export interface DiscoverySourceEvidence {
  seedId?: string;
  seedUsername?: string;
  signal: string;
  discoveryReason?: string;
  discoveredAt: Date;
}

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

  // C2 Discovery candidate fields
  discoveredFromSeedId?: string;
  discoveredFromUsername?: string;
  discoverySignals?: string[];
  discoveryReason?: string;
  discoverySources?: DiscoverySourceEvidence[];
  discoveryCount?: number;
  firstDiscoveredAt?: Date;
  lastDiscoveredAt?: Date;

  verifiedAt?: Date;
  lastScannedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManualSeedInput {
  input: string; // Raw input: @username or profile URL
}

export interface DiscoveredCandidateInput {
  username: string;
  discoveredFromSeedId?: string;
  discoveredFromUsername?: string;
  signal?: string;
  discoveryReason?: string;
  followersCount?: number;
  biography?: string;
  profilePicUrl?: string;
  usConfidence?: number;
  pugRelevance?: number;
}

export interface IngestCandidateResult {
  username: string;
  action:
    | 'created'
    | 'updated'
    | 'ignored-existing-verified'
    | 'ignored-paused'
    | 'ignored-archived'
    | 'invalid_input';
  status?: SeedAccountStatus;
  seedId?: string;
  message?: string;
}

export interface ActiveSeedDto {
  _id: string;
  username: string;
  profileUrl: string;
  verifiedAt?: Date;
  lastScannedAt?: Date;
}

export interface UpdateSeedStatusInput {
  status?: SeedAccountStatus;
  enabled?: boolean;
}
