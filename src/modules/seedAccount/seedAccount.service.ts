import { ObjectId } from 'mongodb';
import { getDB } from '../../config/db';
import { SeedAccount, SeedAccountStatus } from './seedAccount.types';
import { normalizeInstagramUsername } from './seedAccount.helper';

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
 * Update seed account status and enabled state.
 * Supports: pause, resume, archive, restore.
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
    if (updates.enabled && existing.status === 'paused') {
      updateDoc.status = 'verified';
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
