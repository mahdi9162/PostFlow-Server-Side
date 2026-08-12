import { ObjectId } from 'mongodb';

export interface Post {
  _id?: ObjectId;
  account: string;
  day: string;
  caption?: string;
  cta?: string;
  source?: string;
  driveLink?: string;
  hashtags?: string[];
  status: 'pending' | 'posted' | string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
  postedAt?: Date;
}
