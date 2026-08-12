import { ObjectId } from 'mongodb';

export interface User {
  _id?: ObjectId;
  firebaseUid: string;
  email: string;
  requestedRole: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  role: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
}
