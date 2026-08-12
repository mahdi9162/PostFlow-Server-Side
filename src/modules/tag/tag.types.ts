import { ObjectId } from 'mongodb';

export interface Tag {
  _id?: ObjectId;
  account: string;
  createdAt: Date;
  // Other dynamic fields might exist based on current usage
  [key: string]: any;
}
