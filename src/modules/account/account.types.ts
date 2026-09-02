import { ObjectId } from 'mongodb';

export interface AccountLeadFinderConfig {
  enabled: boolean;
  dailyLeadTarget: number;
  releaseBatchSize: number;
  releaseIntervalMinutes: number;
}

export const DEFAULT_ACCOUNT_LEAD_FINDER: AccountLeadFinderConfig = {
  enabled: false,
  dailyLeadTarget: 20,
  releaseBatchSize: 10,
  releaseIntervalMinutes: 180,
};

export interface Account {
  _id?: ObjectId;
  slug: string;
  displayName: string;
  driveFolderName: string;
  platform: 'instagram';
  isActive: boolean;
  order: number;
  dailyPostTarget?: number;
  leadFinder?: AccountLeadFinderConfig;
  createdAt: Date;
  updatedAt: Date;
}
