import { ObjectId } from 'mongodb';
import { getDB } from '../../config/db';
import {
  SeedAccount,
  SeedAccountStatus,
  DiscoveredCandidateInput,
  IngestCandidateResult,
  DiscoverySourceEvidence,
  ActiveSeedDto,
} from './seedAccount.types';
import { normalizeInstagramUsername, normalizeDiscoverySignal } from './seedAccount.helper';

const getCollection = () => getDB().collection<SeedAccount>('seedAccounts');

export class ConflictError extends Error {
  statusCode: number;
  existingRecord?: SeedAccount;
  constructor(message: string, existingRecord?: SeedAccount) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
    this.existingRecord = existingRecord;
  }
}

export class ValidationError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * Fetch all seed accounts with optional status and search filtering.
 */
export const getSeedAccounts = async (filter?: {
  status?: string;
  search?: string;
}): Promise<SeedAccount[]> => {
  const collection = getCollection();
  const query: any = {};

  if (filter?.status && filter.status !== 'all') {
    query.status = filter.status;
  }

  if (filter?.search && filter.search.trim()) {
    const searchClean = filter.search.trim().toLowerCase().replace(/^@/, '');
    query.username = { $regex: searchClean, $options: 'i' };
  }

  return await collection.find(query).sort({ createdAt: -1 }).toArray();
};

/**
 * Fetch a single seed account by MongoDB ObjectId.
 */
export const getSeedAccountById = async (id: string): Promise<SeedAccount | null> => {
  if (!ObjectId.isValid(id)) return null;
  return await getCollection().findOne({ _id: new ObjectId(id) });
};

/**
 * Fetch a seed account by normalized lowercase username.
 */
export const getSeedAccountByUsername = async (username: string): Promise<SeedAccount | null> => {
  return await getCollection().findOne({ username: username.toLowerCase() });
};

/**
 * Add a new verified manual seed account.
 * Normalizes username/URL, checks duplicate, and sets verified defaults.
 */
export const createManualSeedAccount = async (rawInput: string): Promise<SeedAccount> => {
  const normalized = normalizeInstagramUsername(rawInput);
  if (!normalized.isValid || !normalized.username || !normalized.profileUrl) {
    throw new ValidationError(normalized.error || 'Invalid Instagram username or URL');
  }

  const { username, profileUrl } = normalized;
  const collection = getCollection();

  // Check duplicate
  const existing = await collection.findOne({ username });
  if (existing) {
    throw new ConflictError(
      `Seed account '@${username}' already exists (status: ${existing.status}).`,
      existing
    );
  }

  const now = new Date();
  const newSeed: SeedAccount = {
    username,
    profileUrl,
    status: 'verified',
    source: 'manual',
    enabled: true,
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(newSeed);
  return {
    ...newSeed,
    _id: result.insertedId,
  };
};

/**
 * Ingest an auto-discovered candidate account from n8n discovery workflow.
 * 
 * Rules (C2):
 * 1. Normalized lowercase username.
 * 2. If existing is verified -> ignore (do NOT overwrite or change status).
 * 3. If existing is paused -> ignore (do NOT overwrite or reactivate).
 * 4. If existing is archived -> ignore (was rejected/archived previously).
 * 5. If existing is candidate -> merge discovery evidence, increment discoveryCount, update lastDiscoveredAt.
 * 6. If no existing -> create candidate with status='candidate', source='auto-discovery', enabled=false.
 * 7. NEVER auto-enable or auto-verify a candidate.
 */
export const ingestDiscoveredCandidate = async (
  input: DiscoveredCandidateInput
): Promise<IngestCandidateResult> => {
  if (!input || !input.username) {
    return {
      username: '',
      action: 'invalid_input',
      message: 'Username is required',
    };
  }

  const normalized = normalizeInstagramUsername(input.username);
  if (!normalized.isValid || !normalized.username || !normalized.profileUrl) {
    return {
      username: input.username,
      action: 'invalid_input',
      message: normalized.error || 'Invalid Instagram username or URL',
    };
  }

  const { username, profileUrl } = normalized;
  const collection = getCollection();
  const existing = await collection.findOne({ username });

  const signal = normalizeDiscoverySignal(input.signal);
  const now = new Date();

  // 1. Existing Verified Seed -> Ignore
  if (existing?.status === 'verified') {
    return {
      username,
      action: 'ignored-existing-verified',
      status: 'verified',
      seedId: existing._id?.toString(),
      message: 'Account is already an active verified seed',
    };
  }

  // 2. Existing Paused Seed -> Ignore
  if (existing?.status === 'paused') {
    return {
      username,
      action: 'ignored-paused',
      status: 'paused',
      seedId: existing._id?.toString(),
      message: 'Account is already a paused seed',
    };
  }

  // 3. Existing Archived Seed -> Ignore (rejected/archived)
  if (existing?.status === 'archived') {
    return {
      username,
      action: 'ignored-archived',
      status: 'archived',
      seedId: existing._id?.toString(),
      message: 'Account was previously archived/rejected',
    };
  }

  // 4. Existing Candidate -> Merge Evidence & Increment Count
  if (existing?.status === 'candidate') {
    const existingSignals = new Set(existing.discoverySignals || []);
    existingSignals.add(signal);

    const fromUsernameClean = input.discoveredFromUsername
      ? input.discoveredFromUsername.toLowerCase().replace(/^@/, '')
      : undefined;

    const newEvidence: DiscoverySourceEvidence = {
      seedId: input.discoveredFromSeedId,
      seedUsername: fromUsernameClean,
      signal,
      discoveryReason: input.discoveryReason || existing.discoveryReason,
      discoveredAt: now,
    };

    const existingSources = existing.discoverySources || [];
    const isAlreadyRecorded = existingSources.some(
      (s) => s.seedUsername === newEvidence.seedUsername && s.signal === newEvidence.signal
    );
    const updatedSources = isAlreadyRecorded ? existingSources : [...existingSources, newEvidence];

    const updateDoc: any = {
      discoveryCount: (existing.discoveryCount || 1) + 1,
      lastDiscoveredAt: now,
      discoverySignals: Array.from(existingSignals),
      discoverySources: updatedSources,
      updatedAt: now,
    };

    // Update optional metadata if provided in new discovery
    if (input.followersCount !== undefined && input.followersCount !== null) {
      updateDoc.followersCount = input.followersCount;
    }
    if (input.biography) updateDoc.biography = input.biography;
    if (input.profilePicUrl) updateDoc.profilePicUrl = input.profilePicUrl;
    if (input.usConfidence !== undefined) updateDoc.usConfidence = input.usConfidence;
    if (input.pugRelevance !== undefined) updateDoc.pugRelevance = input.pugRelevance;

    await collection.updateOne({ _id: existing._id }, { $set: updateDoc });

    return {
      username,
      action: 'updated',
      status: 'candidate',
      seedId: existing._id?.toString(),
      message: 'Candidate discovery evidence merged and discovery count incremented',
    };
  }

  // 5. New Candidate -> Insert
  const fromUsernameClean = input.discoveredFromUsername
    ? input.discoveredFromUsername.toLowerCase().replace(/^@/, '')
    : undefined;

  const initialEvidence: DiscoverySourceEvidence = {
    seedId: input.discoveredFromSeedId,
    seedUsername: fromUsernameClean,
    signal,
    discoveryReason: input.discoveryReason,
    discoveredAt: now,
  };

  const newCandidate: SeedAccount = {
    username,
    profileUrl,
    status: 'candidate',
    source: 'auto-discovery',
    enabled: false, // MANDATORY: NEVER auto-enabled
    discoveredFromSeedId: input.discoveredFromSeedId,
    discoveredFromUsername: fromUsernameClean,
    discoverySignals: [signal],
    discoveryReason: input.discoveryReason,
    discoverySources: [initialEvidence],
    discoveryCount: 1,
    firstDiscoveredAt: now,
    lastDiscoveredAt: now,
    followersCount: input.followersCount,
    biography: input.biography,
    profilePicUrl: input.profilePicUrl,
    usConfidence: input.usConfidence,
    pugRelevance: input.pugRelevance,
    createdAt: now,
    updatedAt: now,
  };

  const insertRes = await collection.insertOne(newCandidate);
  return {
    username,
    action: 'created',
    status: 'candidate',
    seedId: insertRes.insertedId.toString(),
    message: 'New candidate created for admin review',
  };
};

/**
 * Fetch active verified seeds for automation / n8n workflow.
 * Returns ONLY status='verified' AND enabled=true.
 */
export const getActiveVerifiedSeeds = async (): Promise<ActiveSeedDto[]> => {
  const collection = getCollection();
  const seeds = await collection
    .find(
      { status: 'verified', enabled: true },
      { projection: { _id: 1, username: 1, profileUrl: 1, verifiedAt: 1, lastScannedAt: 1 } }
    )
    .sort({ lastScannedAt: 1, createdAt: 1 })
    .toArray();

  return seeds.map((s) => ({
    _id: s._id!.toString(),
    username: s.username,
    profileUrl: s.profileUrl,
    verifiedAt: s.verifiedAt,
    lastScannedAt: s.lastScannedAt,
  }));
};

/**
 * Update seed account status and enabled state.
 * Supports:
 * - Candidate Approval: candidate -> verified (enabled: true, verifiedAt: now)
 * - Candidate Rejection: candidate -> archived (enabled: false)
 * - Pause: verified -> paused (enabled: false)
 * - Resume: paused -> verified (enabled: true)
 * - Archive: verified/paused -> archived (enabled: false)
 * - Restore: archived -> verified (enabled: true)
 */
export const updateSeedAccount = async (
  id: string,
  updates: {
    status?: SeedAccountStatus;
    enabled?: boolean;
  }
): Promise<SeedAccount | null> => {
  if (!ObjectId.isValid(id)) return null;

  const collection = getCollection();
  const existing = await collection.findOne({ _id: new ObjectId(id) });
  if (!existing) return null;

  const now = new Date();
  const updateDoc: Partial<SeedAccount> = {
    updatedAt: now,
  };

  if (updates.status !== undefined) {
    updateDoc.status = updates.status;

    if (updates.status === 'verified') {
      updateDoc.enabled = updates.enabled !== undefined ? updates.enabled : true;
      if (!existing.verifiedAt) {
        updateDoc.verifiedAt = now;
      }
    } else if (updates.status === 'paused') {
      updateDoc.enabled = false;
    } else if (updates.status === 'archived') {
      updateDoc.enabled = false;
    }
  }

  if (updates.enabled !== undefined && updates.status === undefined) {
    updateDoc.enabled = updates.enabled;
    if (updates.enabled && (existing.status === 'paused' || existing.status === 'candidate')) {
      updateDoc.status = 'verified';
      if (!existing.verifiedAt) updateDoc.verifiedAt = now;
    } else if (!updates.enabled && existing.status === 'verified') {
      updateDoc.status = 'paused';
    }
  }

  const res = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateDoc },
    { returnDocument: 'after' }
  );

  return res as SeedAccount | null;
};
