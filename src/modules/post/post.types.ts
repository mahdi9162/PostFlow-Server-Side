import { ObjectId } from 'mongodb';

export interface PostMedia {
  provider: 'google-drive';
  driveFileId: string;
  fileName?: string;
  mimeType?: string;
  fingerprint?: string;
}

export interface Post {
  _id?: ObjectId;
  account: string;
  scheduledDate?: string; // YYYY-MM-DD
  day: string;
  caption?: string;
  cta?: string;
  source?: string | null;
  driveLink?: string; // Legacy
  media?: PostMedia;
  hashtags?: string; // It was string in frontend, array in old types, but let's keep it string since textarea stores it as string
  status: 'pending' | 'posted' | string;
  createdBy?: 'manual' | 'automation';
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
  postedAt?: Date;
}
