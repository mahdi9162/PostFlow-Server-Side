import { ObjectId } from 'mongodb';

export interface Account {
  _id?: ObjectId;
  slug: string;
  displayName: string;
  driveFolderName: string;
  platform: 'instagram';
  isActive: boolean;
  order: number;
  dailyPostTarget?: number;
  createdAt: Date;
  updatedAt: Date;
}
