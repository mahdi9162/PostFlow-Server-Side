import { getDB } from '../../config/db';
import { ObjectId } from 'mongodb';
import { Account } from './account.types';

const getCollection = () => getDB().collection<Account>('accounts');

export const getAccounts = async (query: any = {}) => {
  return await getCollection().find(query).sort({ order: 1 }).toArray();
};

export const getAccountById = async (id: string) => {
  return await getCollection().findOne({ _id: new ObjectId(id) });
};

export const getAccountBySlug = async (slug: string) => {
  return await getCollection().findOne({ slug });
};

export const createAccount = async (account: Omit<Account, '_id' | 'createdAt' | 'updatedAt'>) => {
  const newAccount: Account = {
    ...account,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return await getCollection().insertOne(newAccount);
};

export const updateAccount = async (id: string, updateData: Partial<Account>) => {
  const update = {
    ...updateData,
    updatedAt: new Date(),
  };
  return await getCollection().updateOne({ _id: new ObjectId(id) }, { $set: update });
};

export const deleteAccount = async (id: string) => {
  return await getCollection().deleteOne({ _id: new ObjectId(id) });
};

export const findActiveInstagramAccounts = async () => {
  return await getCollection().find({ platform: 'instagram', isActive: true }).sort({ order: 1 }).toArray();
};

export const checkSlugInUse = async (slug: string): Promise<boolean> => {
  const db = getDB();
  const postInUse = await db.collection('posts').findOne({ account: slug });
  if (postInUse) return true;
  
  const groupInUse = await db.collection('hashtagGroups').findOne({ account: slug });
  if (groupInUse) return true;

  const rotationInUse = await db.collection('hashtagRotations').findOne({ account: slug });
  if (rotationInUse) return true;

  return false;
};
