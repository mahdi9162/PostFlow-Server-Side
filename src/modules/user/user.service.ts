import { getDB } from '../../config/db';
import { ObjectId } from 'mongodb';
import { User } from './user.types';

const getCollection = () => getDB().collection<User>('users');

export const createUser = async (user: User) => {
  return await getCollection().insertOne(user);
};

export const findUserByFirebaseUid = async (uid: string) => {
  return await getCollection().findOne({ firebaseUid: uid });
};

export const findPendingRequests = async () => {
  return await getCollection().find({ status: 'pending' }).sort({ createdAt: -1 }).toArray();
};

export const findUserById = async (id: string) => {
  return await getCollection().findOne({ _id: new ObjectId(id) });
};

export const updateUserStatus = async (id: string, updateData: Partial<User>) => {
  return await getCollection().updateOne(
    { _id: new ObjectId(id) },
    { $set: updateData }
  );
};
