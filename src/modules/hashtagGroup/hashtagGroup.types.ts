import { ObjectId } from 'mongodb';

export interface HashtagGroup {
  _id?: ObjectId;
  account: string;
  name: string;
  hashtags: string[]; // exactly 5 normalized tags
  order: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt?: Date;
}
